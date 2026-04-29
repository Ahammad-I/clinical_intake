"""
Development settings — extends base.py.
Used by: manage.py runserver
"""
from .base import *  # noqa: F401, F403

DEBUG = True

# In dev we also allow BrowsableAPIRenderer so you can test endpoints
# in your browser at http://127.0.0.1:8000/api/
REST_FRAMEWORK['DEFAULT_RENDERER_CLASSES'] += [  # noqa: F405
    'rest_framework.renderers.BrowsableAPIRenderer',
]

# Relax CORS in dev — allow everything from localhost
CORS_ALLOW_ALL_ORIGINS = True