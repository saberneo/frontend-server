#!/usr/bin/env python3
"""
Gmail Automation Script - Simple Authentication
Uses SMTP/IMAP with username and password (no OAuth, no credentials.json)

Requirements:
    pip install icalendar

Setup:
    1. Enable 2FA on your Gmail account
    2. Generate App Password: https://myaccount.google.com/apppasswords
    3. Run this script and enter your email and App Password
"""

import json
import smtplib
import imaplib
import time
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate
import os
import getpass
import sys


class SimpleGmailAutomation:
    """Simple Gmail automation using SMTP/IMAP - NO OAuth required"""

    def __init__(self, email=None, app_password=None, to=None):
        self.email = email
        self.to=to
        self.app_password = app_password
        self.smtp_conn = None
        self.imap_conn = None

        print("\n" + "=" * 70)
        print("Gmail Automation - Simple Authentication (No OAuth)")
        print("=" * 70)

        if not email or not app_password:
            self.get_credentials()

        self.connect()

    def get_credentials(self):
        """Get email and app password from user"""
        print("\n⚠️  You need a Gmail App Password (not your regular password)")
        print("   Steps to get App Password:")
        print("   1. Go to: https://myaccount.google.com/apppasswords")
        print("   2. Select 'Mail' and generate password")
        print("   3. Copy the 16-character password\n")

        self.email = input("Gmail address: ").strip()
        self.app_password = getpass.getpass("App Password (16 chars): ").strip()

        # Remove spaces from app password
        self.app_password = self.app_password.replace(' ', '')

    def connect(self):
        """Connect to Gmail via SMTP and IMAP"""
        try:
            print("\n🔐 Connecting to Gmail...")

            # Connect SMTP (for sending)
            self.smtp_conn = smtplib.SMTP('smtp.gmail.com', 587)
            self.smtp_conn.starttls()
            self.smtp_conn.login(self.email, self.app_password)
            print("✅ SMTP connected (sending enabled)")

            # Connect IMAP (for reading/drafts)
            self.imap_conn = imaplib.IMAP4_SSL('imap.gmail.com', 993)
            self.imap_conn.login(self.email, self.app_password)
            print("✅ IMAP connected (reading enabled)")

            print("\n✅ Successfully authenticated!\n")

        except smtplib.SMTPAuthenticationError:
            print("\n❌ Authentication failed!")
            print("\nCommon issues:")
            print("  • Using regular password instead of App Password")
            print("  • 2FA not enabled on Gmail account")
            print("  • App Password not generated yet")
            print("\nSolution:")
            print("  1. Enable 2FA: https://myaccount.google.com/security")
            print("  2. Generate App Password: https://myaccount.google.com/apppasswords")
            print("  3. Use the 16-character App Password (not your regular password)")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Connection failed: {e}")
            sys.exit(1)

    def send_email(self, to, subject, body):
        """Send an email"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email
            msg['To'] = to
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)

            msg.attach(MIMEText(body, 'plain'))

            self.smtp_conn.send_message(msg)
            print(f"✉️  Sent: {subject}")
            return True

        except Exception as e:
            print(f"❌ Send failed: {e}")
            return False

    def create_draft(self, subject, body):
        """Create email in drafts folder"""
        try:
            msg = MIMEMultipart()
            msg['From'] = self.email
            msg['To'] = self.email
            msg['Subject'] = subject
            msg['Date'] = formatdate(localtime=True)

            msg.attach(MIMEText(body, 'plain'))

            self.imap_conn.append(
                '[Gmail]/Drafts',
                '',
                imaplib.Time2Internaldate(time.time()),
                msg.as_bytes()
            )
            print(f"📝 Draft: {subject[:50]}...")
            return True

        except Exception as e:
            print(f"❌ Draft failed: {e}")
            return False

    def send_test_email(self):
        """Send a test email"""
        print("\n🧪 Sending test email...")

        subject = "✅ Test Email - Mini-Mindy Automation"
        body = """This is a test email from the Mini-Mindy automation script.

If you can see this, your Gmail authentication is working correctly!

Next steps:
1. Run the full simulation to generate demo emails
2. Configure Kafka to read from this Gmail account
3. Process emails through Spark pipeline

Technical details:
- Authentication: SMTP/IMAP with App Password
- No OAuth required
- No credentials.json needed"""

        success = self.send_email(self.email, subject, body)

        if success:
            print("\n✅ Test email sent successfully!")
            print(f"   Check your inbox: {self.email}")

        return success

    def load_simulation_data(self):
        """Load email simulation data"""
        try:
            with open('work_emails.json', 'r') as f:
                work = json.load(f)
            with open('personal_emails.json', 'r') as f:
                personal = json.load(f)
            with open('spam_emails.json', 'r') as f:
                spam = json.load(f)

            print("✅ Data files loaded")
            return work, personal, spam

        except FileNotFoundError:
            print("\n❌ Data files not found!")
            print("   Run: python email_simulation_data.py")
            return None, None, None

    def simulate_emails(self, use_drafts=True):
        """Simulate all emails"""
        work, personal, spam = self.load_simulation_data()

        if not work:
            return

        print(f"\n{'=' * 70}")
        print(f"🚀 Starting Email Simulation")
        print(f"   Method: {'Drafts' if use_drafts else 'Send to Inbox'}")
        print(f"{'=' * 70}\n")

        total = 0

        # Process work emails
        for day, emails in work.items():
            print(f"\n📅 {day}")
            for email in emails:
                if use_drafts:
                    self.create_draft(
                        f"[FROM: {email['from']}] {email['subject']}",
                        f"Sender: {email['from']}\n\n{email['body']}"
                    )
                else:
                    self.send_email(
                        self.to,
                        email['subject'],
                        email['body']
                    )
                total += 1
                time.sleep(0.5)

        # Process personal emails
        print(f"\n📬 Personal Emails")
        for email in personal[2:]:
            if use_drafts:
                self.create_draft(
                    f"[FROM: {email['from']}] {email['subject']}",
                    email['body']
                )
            else:
                self.send_email(self.to, email['subject'], email['body'])
            total += 1
            time.sleep(5)

        # Process spam
        print(f"\n🗑️  Spam Emails")
        for email in spam[:2]:
            if use_drafts:
                self.create_draft(
                    f"[SPAM: {email['from']}] {email['subject']}",
                    email['body']
                )
            else:
                self.send_email(self.to, email['subject'], email['body'])
            total += 1
            time.sleep(0.5)

        print(f"\n{'=' * 70}")
        print(f"✅ Simulation complete! {total} emails created")
        print(f"{'=' * 70}\n")

    def close(self):
        """Close connections"""
        try:
            if self.smtp_conn:
                self.smtp_conn.quit()
            if self.imap_conn:
                self.imap_conn.logout()
            print("🔒 Connections closed")
        except:
            pass


def main():
    """Main menu"""
    print("""
╔══════════════════════════════════════════════════════════════════╗
║                   Mini-Mindy Email Automation                    ║
║              Simple Authentication (No OAuth/API)                ║
╚══════════════════════════════════════════════════════════════════╝
""")

    print("What would you like to do?\n")
    print("  1. Send test email (verify authentication)")
    print("  2. Simulate all emails as DRAFTS (recommended)")
    print("  3. Simulate all emails SENT to inbox")
    print("  4. Exit\n")

    choice = input("Select (1-4): ").strip()

    if choice == '4':
        print("\nGoodbye! 👋\n")
        return

    # Create automation instance
    gmail = SimpleGmailAutomation()
    gmail.to="mindy.demo.mindy@gmail.com"
    try:
        if choice == '1':
            gmail.send_test_email()

        elif choice == '2':
            print("\n⚠️  This will create ~15 draft emails in your account")
            confirm = input("Continue? (y/n): ").strip().lower()
            if confirm == 'y':
                gmail.simulate_emails(use_drafts=True)
                print("\n💡 To view drafts: Open Gmail → Drafts folder")

        elif choice == '3':
            print("\n⚠️  This will send ~15 emails to your inbox")
            confirm = input("Continue? (y/n): ").strip().lower()
            if (confirm ==
                    'y'):
                gmail.simulate_emails(use_drafts=False)
                print("\n💡 To view emails: Open Gmail → Inbox")

        else:
            print("\n❌ Invalid option")

    finally:
        gmail.close()


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user\n")
        sys.exit(0)