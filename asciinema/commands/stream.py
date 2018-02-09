import sys
import os

from asciinema.commands.command import Command
import asciinema.asciicast as asciicast
import asciinema.asciicast.v2 as v2
from asciinema.api import APIError


class StreamCommand(Command):

    def __init__(self, api, args, env=None):
        Command.__init__(self, args.quiet)
        self.api = api
        self.rec_stdin = args.stdin
        self.command = args.command
        self.env_whitelist = args.env
        self.title = args.title
        self.assume_yes = args.yes or args.quiet
        self.idle_time_limit = args.idle_time_limit
        self.streamer = v2.Streamer()
        self.env = env if env is not None else os.environ

    def execute(self):
        upload = False


        self.print_info("Initializing your stream...")
        self.print_info("""Hit <Ctrl-D> or type "exit" when you're done.""")

        command = self.command or self.env.get('SHELL') or 'sh'
        command_env = self.env.copy()
        if 'ASCIINEMA_REC' in command_env and command_env['ASCIINEMA_REC'] == '1':
            self.print_info("""WARNING: you are nesting sessions!""")
        command_env['ASCIINEMA_REC'] = '1'
        vars = filter(None, map((lambda var: var.strip()), self.env_whitelist.split(',')))
        captured_env = {var: self.env.get(var) for var in vars}

        self.streamer.stream(
            command,
            command_env,
            captured_env,
            self.rec_stdin,
            self.title,
            self.idle_time_limit
        )

        self.print_info("Streaming ended.")

        return 0

