"""Django email backend for Resend's HTTPS API (https://resend.com/docs/api-reference/emails/send-email).

HTTPS rather than SMTP because hosting platforms often block outbound SMTP ports.
"""

import json
import urllib.request

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend


class ResendBackend(BaseEmailBackend):
    def send_messages(self, messages):
        for m in messages:
            body = {"from": m.from_email, "to": m.to, "subject": m.subject, "text": m.body}
            request = urllib.request.Request(
                "https://api.resend.com/emails",
                data=json.dumps(body).encode(),
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "blufin-backend",
                },
            )
            try:
                urllib.request.urlopen(request, timeout=10).close()
            except Exception:
                if not self.fail_silently:
                    raise
        return len(messages)
