"""
Root URL configuration.

All intake endpoints are namespaced under /api/intake/
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    # Django admin
    path('admin/', admin.site.urls),

    # All intake API routes
    path('api/intake/', include('apps.intake.urls', namespace='intake')),
]

# Serve uploaded media files during development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)