import smtplib
import imaplib
import email
from email.mime.text import MIMEText
from email.header import decode_header
import os

class GmailController:
    """Controlador para enviar y leer correos electrónicos de Gmail usando contraseñas de aplicación"""

    def __init__(self, memory_system=None):
        self.memory_system = memory_system

    def _get_credentials(self, user_id: str) -> tuple[str, str]:
        """Obtiene las credenciales de Gmail de las preferencias del usuario"""
        if not self.memory_system:
            return None, None
            
        gmail_user = self.memory_system.get_preference(user_id, "gmail_user")
        gmail_password = self.memory_system.get_preference(user_id, "gmail_password")
        return gmail_user, gmail_password

    def send_email(self, user_id: str, to_email: str, subject: str, body: str) -> dict:
        """Envía un correo electrónico usando SMTP de Gmail"""
        gmail_user, gmail_password = self._get_credentials(user_id)
        
        if not gmail_user or not gmail_password:
            return {
                "status": "error",
                "message": "Credenciales de Gmail no configuradas. Usa 'gmail_user' y 'gmail_password' en preferencias."
            }

        try:
            msg = MIMEText(body, "plain", "utf-8")
            msg["Subject"] = subject
            msg["From"] = gmail_user
            msg["To"] = to_email

            # Conectar a Gmail SMTP
            server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
            server.login(gmail_user, gmail_password)
            server.sendmail(gmail_user, [to_email], msg.as_string())
            server.close()

            return {
                "status": "success",
                "message": f"Correo enviado con éxito a {to_email}"
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error enviando correo: {str(e)}"
            }

    def check_emails(self, user_id: str, limit: int = 3) -> dict:
        """Comprueba los últimos correos no leídos usando IMAP de Gmail"""
        gmail_user, gmail_password = self._get_credentials(user_id)
        
        if not gmail_user or not gmail_password:
            return {
                "status": "error",
                "message": "Credenciales de Gmail no configuradas. Por favor regístralas."
            }

        try:
            # Conectar a Gmail IMAP
            mail = imaplib.IMAP4_SSL("imap.gmail.com")
            mail.login(gmail_user, gmail_password)
            mail.select("inbox")

            # Buscar correos no leídos
            status, messages = mail.search(None, 'UNSEEN')
            mail_ids = messages[0].split()

            if not mail_ids:
                mail.close()
                mail.logout()
                return {
                    "status": "success",
                    "count": 0,
                    "emails": [],
                    "message": "No tienes correos nuevos sin leer."
                }

            emails_list = []
            # Obtener los más recientes hasta el límite
            for mail_id in reversed(mail_ids[-limit:]):
                status, data = mail.fetch(mail_id, '(RFC822)')
                for response_part in data:
                    if isinstance(response_part, tuple):
                        msg = email.message_from_bytes(response_part[1])
                        
                        # Decodificar Asunto
                        subject, encoding = decode_header(msg["Subject"])[0]
                        if isinstance(subject, bytes):
                            subject = subject.decode(encoding or "utf-8", errors="ignore")
                            
                        # Decodificar Remitente
                        from_sender, encoding = decode_header(msg["From"])[0]
                        if isinstance(from_sender, bytes):
                            from_sender = from_sender.decode(encoding or "utf-8", errors="ignore")

                        # Intentar obtener el cuerpo
                        body = ""
                        if msg.is_multipart():
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                content_disposition = str(part.get("Content-Disposition"))
                                if content_type == "text/plain" and "attachment" not in content_disposition:
                                    body_bytes = part.get_payload(decode=True)
                                    body = body_bytes.decode("utf-8", errors="ignore")
                                    break
                        else:
                            body_bytes = msg.get_payload(decode=True)
                            body = body_bytes.decode("utf-8", errors="ignore")

                        emails_list.append({
                            "from": from_sender,
                            "subject": subject,
                            "snippet": body[:120] + "..." if len(body) > 120 else body
                        })

            mail.close()
            mail.logout()

            return {
                "status": "success",
                "count": len(mail_ids),
                "emails": emails_list
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Error leyendo correos: {str(e)}"
            }
