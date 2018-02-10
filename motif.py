from asciinema.__main__ import main
main()

# require asciinema like above, so you can pyinstaller a single .py file
# then, from this link
# https://stackoverflow.com/questions/15114695/pyinstaller-import-error
# I found that you need to not only declare requests as a hidden module,
# but add to pathex, which is basically the classpath
