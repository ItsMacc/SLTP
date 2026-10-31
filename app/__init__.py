# -------- __init__.py --------
# The application package.
#
# It exists so `app` is a real package rather than a namespace shared with anything
# else named `app` on sys.path. The subpackages below keep their own initializers
# only where they re-export something the rest of the code imports.
