import os
import subprocess
import json
import json.decoder
import time
import codecs
import requests
from requests_futures.sessions import FuturesSession
from multiprocessing import Process, Queue

from asciinema.pty_recorder import PtyRecorder


try:
    JSONDecodeError = json.decoder.JSONDecodeError
except AttributeError:
    JSONDecodeError = ValueError


class LoadError(Exception):
    pass


class Asciicast:

    def __init__(self, f, idle_time_limit):
        self.version = 2
        self.__file = f
        self.idle_time_limit = idle_time_limit

    def stdout(self):
        for line in self.__file:
            time, type, data = json.loads(line)

            if type == 'o':
                yield [time, data]


def build_from_header_and_file(header, f):
    idle_time_limit = header.get('idle_time_limit')
    return Asciicast(f, idle_time_limit)


class open_from_file():
    FORMAT_ERROR = "only asciicast v2 format can be opened"

    def __init__(self, first_line, file):
        self.first_line = first_line
        self.file = file

    def __enter__(self):
        try:
            v2_header = json.loads(self.first_line)
            if v2_header.get('version') == 2:
                return build_from_header_and_file(v2_header, self.file)
            else:
                raise LoadError(self.FORMAT_ERROR)
        except JSONDecodeError as e:
            raise LoadError(self.FORMAT_ERROR)

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.file.close()


def get_duration(path):
    with open(path, mode='rt', encoding='utf-8') as f:
        first_line = f.readline()
        with open_from_file(first_line, f) as a:
            for last_frame in a.stdout():
                pass
            return last_frame[0]


def write_json_lines_from_queue(path, mode, queue):
    with open(path, mode=mode, buffering=1) as f:
        for json_value in iter(queue.get, None):
            line = json.dumps(json_value, ensure_ascii=False, indent=None, separators=(', ', ': '))
            f.write(line + '\n')


class writer():

    def __init__(self, path, header, rec_stdin, start_time_offset=0):
        self.path = path
        self.header = header
        self.rec_stdin = rec_stdin
        self.start_time_offset = start_time_offset
        self.queue = Queue()
        self.stdin_decoder = codecs.getincrementaldecoder('UTF-8')('replace')
        self.stdout_decoder = codecs.getincrementaldecoder('UTF-8')('replace')

        self.session = FuturesSession()
        self.host = 'http://localhost:3003'
        # self.host = 'https://term.motif.gq'

        r = requests.get(self.host + '/request-session')
        self.sessionKey = r.json()['id']
        self.header['stream_url'] = self.host + '/stream/' + self.sessionKey
        print(self.host + '/?session=' + self.sessionKey)
        header = json.dumps(self.header, ensure_ascii=False, indent=None, separators=(', ', ': '))
        self.session.post(self.host + '/push-header', data={'header':header, 'session': self.sessionKey})
        self.seqno = 0

    def __enter__(self):
        mode = 'a' if self.start_time_offset > 0 else 'w'
        self.process = Process(
            target=write_json_lines_from_queue,
            args=(self.path, mode, self.queue)
        )
        self.process.start()
        if self.start_time_offset == 0:
            self.queue.put(self.header)
        self.start_time = time.time() - self.start_time_offset
        return self

    def __exit__(self, exc_type, exc_value, exc_traceback):
        self.session.post(self.host + '/end-session', data={'session': self.sessionKey})
        self.queue.put(None)
        self.process.join()

    def write_stdin(self, data):
        if self.rec_stdin:
            text = self.stdin_decoder.decode(data)

            if text:
                ts = round(time.time() - self.start_time, 6)
                self.queue.put([ts, 'i', text])

    def write_stdout(self, data):
        text = self.stdout_decoder.decode(data)

        if text:
            ts = round(time.time() - self.start_time, 6)
            self.queue.put([ts, 'o', text])
            # with open('/tmp/asciistream.json', 'a') as f:
            #     json_value = [ts, 'o', text]
            #     line = json.dumps(json_value, ensure_ascii=False, indent=None, separators=(', ', ': '))
            #     f.write(line + "\n")
            json_value = [ts, 'o', text]
            line = json.dumps(json_value, ensure_ascii=False, indent=None, separators=(', ', ': '))
            self.seqno += 1
            self.session.post(self.host + '/push-event', data={'event': line, 'seqno': self.seqno, 'session': self.sessionKey})

    def write_resize(self, dims):
        ts = round(time.time() - self.start_time, 6)
        self.queue.put([ts, 'm', dims])

        json_value = [ts, 'm', dims]
        line = json.dumps(json_value, ensure_ascii=False, indent=None, separators=(', ', ': '))
        self.seqno += 1
        self.session.post(self.host + '/push-event', data={'event': line, 'seqno': self.seqno, 'session': self.sessionKey})


class Recorder:

    def __init__(self, pty_recorder=None):
        self.pty_recorder = pty_recorder if pty_recorder is not None else PtyRecorder()

    def record(self, path, append, command, command_env, captured_env, rec_stdin, title, idle_time_limit):
        start_time_offset = 0

        if append and os.stat(path).st_size > 0:
            start_time_offset = get_duration(path)

        cols = int(subprocess.check_output(['tput', 'cols']))
        lines = int(subprocess.check_output(['tput', 'lines']))

        header = {
            'version': 2,
            'width': cols,
            'height': lines,
            'timestamp': int(time.time()),
            'idle_time_limit': idle_time_limit,
        }

        if captured_env:
            header['env'] = captured_env

        if title:
            header['title'] = title

        with writer(path, header, rec_stdin, start_time_offset) as w:
            self.pty_recorder.record_command(['sh', '-c', command], w, command_env)

