# Email Simulation Data Generator and Automation Script
# This script creates realistic email and calendar data for the Mini-Mindy demo

import json
from datetime import datetime, timedelta
import random

# ============================================================================
# 1. WORK EMAILS - Business Communications
# ============================================================================

work_emails = {
    "day1_monday": [
        {
            "id": "email_001",
            "from": "tom.anderson@acmecorp.com",
            "to": "sarah.vp@company.com",
            "subject": "Production Issue - Need Immediate Support",
            "body": """Hi Sarah,

We're experiencing a critical production issue affecting approximately 500 users. The application has been throwing 500 errors since 10 PM last night.

This is severely impacting our business operations and we need immediate assistance. Can we schedule an emergency call to discuss resolution?

Our technical team is available anytime today.

Best regards,
Tom Anderson
CTO, Acme Corp""",
            "timestamp": "2025-01-06T22:47:00Z",
            "labels": ["IMPORTANT", "INBOX"],
            "sentiment": "frustrated",
            "priority": "urgent",
            "expected_response": {
                "from": "sarah.vp@company.com",
                "to": "tom.anderson@acmecorp.com",
                "subject": "Re: Production Issue - Immediate Action",
                "body": """Hi Tom,

I sincerely apologize for the delay in response. I understand the critical nature of the production issue affecting your users.

I've immediately escalated this to our engineering team and would like to schedule an emergency call at 11:00 AM today to discuss the resolution plan and next steps.

I'm also looping in our CTO Mike Stevens to ensure we have the right technical expertise on the call.

Please confirm if 11 AM works for you.

Best regards,
Sarah""",
                "cc": ["mike.stevens@company.com"]
            }
        },
        {
            "id": "email_002",
            "from": "john.sales@company.com",
            "to": "sarah.vp@company.com",
            "subject": "Q4 Pipeline Review - Updated Numbers",
            "body": """Hi Sarah,

Wanted to share the latest Q4 pipeline numbers before our meeting this afternoon:

- Total pipeline: $2.3M (up 15% from last week)
- Hot deals: 5 accounts ($850K total)
- At risk: 2 accounts ($200K) - need your help

Can we discuss the at-risk accounts in our 1-on-1?

Thanks,
John""",
            "timestamp": "2025-01-06T08:15:00Z",
            "labels": ["INBOX"],
            "sentiment": "neutral",
            "priority": "normal"
        },
        {
            "id": "email_003",
            "from": "maria.finance@company.com",
            "to": "sarah.vp@company.com",
            "subject": "Budget Approval Needed - Q1 Marketing Spend",
            "body": """Sarah,

I need your approval on the Q1 marketing budget by EOD today. The total is $125K, broken down as:

- Digital advertising: $60K
- Events and conferences: $40K
- Content creation: $25K

Please review the attached spreadsheet and let me know if you have any concerns.

Thanks,
Maria""",
            "timestamp": "2025-01-06T09:30:00Z",
            "labels": ["INBOX"],
            "attachments": ["Q1_Marketing_Budget.xlsx"],
            "sentiment": "neutral",
            "priority": "normal"
        },
        {
            "id": "email_004",
            "from": "jennifer.martinez@techflow.com",
            "to": "sarah.vp@company.com",
            "subject": "Contract Renewal Questions",
            "body": """Hi Sarah,

Hope you're doing well! We're looking to renew our contract next month and have a few questions:

1. Can we add 50 more user licenses?
2. Is there a discount for annual payment vs quarterly?
3. Can we get a demo of the new features?

Looking forward to our meeting on Wednesday.

Best,
Jennifer Martinez
VP Operations, TechFlow Inc""",
            "timestamp": "2025-01-06T14:20:00Z",
            "labels": ["INBOX"],
            "sentiment": "positive",
            "priority": "normal"
        }
    ],
    "day2_tuesday": [
        {
            "id": "email_005",
            "from": "tom.anderson@acmecorp.com",
            "to": "sarah.vp@company.com",
            "subject": "Re: Production Issue - Status Update?",
            "body": """Sarah,

Following up on the production issue from yesterday. We still haven't received a timeline for resolution.

Our users are getting increasingly frustrated and we're considering alternative solutions if this isn't resolved soon.

Can you provide an update?

Tom""",
            "timestamp": "2025-01-07T07:23:00Z",
            "labels": ["IMPORTANT", "INBOX"],
            "sentiment": "frustrated",
            "priority": "urgent"
        },
        {
            "id": "email_006",
            "from": "lisa.chen@acmecorp.com",
            "to": "sarah.vp@company.com",
            "subject": "Executive Review Meeting Request",
            "body": """Dear Sarah,

I'm Lisa Chen, VP of Operations at Acme Corp. I'd like to schedule an executive review meeting to discuss our partnership and address some concerns.

Would you be available for a call this week?

Best regards,
Lisa Chen""",
            "timestamp": "2025-01-07T08:15:00Z",
            "labels": ["INBOX"],
            "sentiment": "neutral",
            "priority": "high"
        },
        {
            "id": "email_007",
            "from": "robert.kim@globalsystems.com",
            "to": "sarah.vp@company.com",
            "subject": "Quarterly Review - Agenda Confirmation",
            "body": """Hi Sarah,

Confirming our quarterly review meeting for Thursday at 2 PM. Here's the agenda:

1. Q4 performance review
2. 2025 goals and initiatives
3. Technical roadmap discussion
4. Budget planning

Let me know if you'd like to add anything.

Best,
Robert Kim""",
            "timestamp": "2025-01-07T11:45:00Z",
            "labels": ["INBOX"],
            "sentiment": "neutral",
            "priority": "normal"
        }
    ],
    "day3_wednesday": [
        {
            "id": "email_008",
            "from": "amanda.foster@datacorp.com",
            "to": "sarah.vp@company.com",
            "subject": "Product Demo Follow-up - Pricing Questions",
            "body": """Hi Sarah,

Thank you for the product demo yesterday! Our team is very excited about the possibilities.

We have a few pricing questions:
1. Volume discounts for 200+ users?
2. Implementation costs and timeline?
3. Integration with our existing CRM?
4. Training and support options?

Can we schedule a call to discuss?

Best,
Amanda Foster
Director of Technology, DataCorp""",
            "timestamp": "2025-01-08T09:30:00Z",
            "labels": ["INBOX"],
            "sentiment": "positive",
            "priority": "high"
        },
        {
            "id": "email_009",
            "from": "mike.stevens@company.com",
            "to": "sarah.vp@company.com",
            "subject": "Technical Architecture Review - Action Items",
            "body": """Sarah,

Following up from yesterday's architecture review meeting. Here are the action items:

1. Review scalability proposal (YOU - by Friday)
2. Approve infrastructure budget increase (YOU - by EOW)
3. Schedule follow-up with engineering team

Let me know if you have questions.

Mike""",
            "timestamp": "2025-01-08T15:20:00Z",
            "labels": ["INBOX"],
            "sentiment": "neutral",
            "priority": "normal"
        }
    ],
    "day4_thursday": [
        {
            "id": "email_010",
            "from": "jennifer.hr@company.com",
            "to": "sarah.vp@company.com",
            "subject": "Performance Review Reminder - Direct Reports",
            "body": """Hi Sarah,

Friendly reminder that performance reviews for your direct reports are due by next Friday.

Outstanding reviews:
- John (Sales Manager)
- Maria (Finance Lead)
- Alex (Product Manager)

Please complete these in the HR portal by January 17th.

Thanks,
Jennifer
HR Department""",
            "timestamp": "2025-01-09T10:00:00Z",
            "labels": ["INBOX"],
            "sentiment": "neutral",
            "priority": "normal"
        },
        {
            "id": "email_011",
            "from": "ceo@company.com",
            "to": "sarah.vp@company.com",
            "subject": "Board Meeting Preparation - Sales Update",
            "body": """Sarah,

Board meeting is next Tuesday. I need your sales update by Monday EOD covering:

1. Q4 results vs forecast
2. Q1 pipeline and projections
3. Key wins and challenges
4. Strategic initiatives for 2025

Keep it to 10 slides max.

Thanks,
David""",
            "timestamp": "2025-01-09T16:45:00Z",
            "labels": ["IMPORTANT", "INBOX"],
            "sentiment": "neutral",
            "priority": "high"
        }
    ],
    "day5_friday": [
        {
            "id": "email_012",
            "from": "team@company.com",
            "to": "sarah.vp@company.com",
            "subject": "Team Happy Hour - Today at 5 PM",
            "body": """Hey team!

Don't forget - happy hour at Murphy's Bar today at 5 PM to celebrate closing Q4 strong!

First round is on the company 🍺

See you there!
- Events Team""",
            "timestamp": "2025-01-10T14:00:00Z",
            "labels": ["INBOX"],
            "sentiment": "positive",
            "priority": "low"
        }
    ]
}

# ============================================================================
# 2. PERSONAL EMAILS - Family, Shopping, Newsletters
# ============================================================================

personal_emails = [
    {
        "id": "personal_001",
        "from": "school@kidschool.edu",
        "to": "sarah.vp@company.com",
        "subject": "Parent-Teacher Conference Scheduled",
        "body": """Dear Parent,

Your parent-teacher conference has been scheduled for:

Date: January 15th
Time: 4:00 PM
Teacher: Ms. Johnson
Student: Emma

Please confirm your attendance by replying to this email.

Best regards,
Oakwood Elementary School""",
        "timestamp": "2025-01-06T11:30:00Z",
        "labels": ["PERSONAL", "INBOX"],
        "category": "family"
    },
    {
        "id": "personal_002",
        "from": "orders@amazon.com",
        "to": "sarah.vp@company.com",
        "subject": "Your Amazon order has shipped",
        "body": """Hello,

Your order #123-4567890-1234567 has shipped!

Items:
- Kids' Science Kit
- Noise-Canceling Headphones

Expected delivery: January 10th

Track your package: [tracking link]

Thanks for shopping with Amazon!""",
        "timestamp": "2025-01-07T09:15:00Z",
        "labels": ["PERSONAL", "INBOX"],
        "category": "shopping"
    },
    {
        "id": "personal_003",
        "from": "newsletter@techcrunch.com",
        "to": "sarah.vp@company.com",
        "subject": "Daily Crunch: AI Startup Raises $100M Series B",
        "body": """Good morning!

Today's top tech stories:
- AI Startup SecureAI Raises $100M Series B
- Google Announces New Cloud Features
- Cybersecurity Threats on the Rise

[Read more...]

--
TechCrunch Newsletter
Unsubscribe | Manage Preferences""",
        "timestamp": "2025-01-08T07:00:00Z",
        "labels": ["NEWSLETTER", "INBOX"],
        "category": "newsletter"
    },
    {
        "id": "personal_004",
        "from": "mom@family.com",
        "to": "sarah.vp@company.com",
        "subject": "Re: Weekend Plans",
        "body": """Hi Sweetie,

Yes, we'd love to come over for Sunday brunch! We'll bring mimosas and fresh bagels.

Is 11 AM still good?

Love,
Mom""",
        "timestamp": "2025-01-08T19:30:00Z",
        "labels": ["PERSONAL", "INBOX"],
        "category": "family"
    },
    {
        "id": "personal_005",
        "from": "noreply@spotify.com",
        "to": "sarah.vp@company.com",
        "subject": "Your Spotify Wrapped 2024 is Ready!",
        "body": """Hey there!

Your 2024 Spotify Wrapped is ready! Discover your top songs, artists, and genres of the year.

View Your Wrapped →

Happy listening!
- The Spotify Team""",
        "timestamp": "2025-01-09T08:00:00Z",
        "labels": ["NEWSLETTER", "INBOX"],
        "category": "entertainment"
    },
    {
        "id": "personal_006",
        "from": "trainer@fitnessstudio.com",
        "to": "sarah.vp@company.com",
        "subject": "Personal Training Session Reminder - Tomorrow 7 AM",
        "body": """Hi Sarah!

Reminder: Your personal training session is tomorrow (Saturday) at 7:00 AM.

We'll focus on upper body strength and core work.

See you bright and early!

Coach Mike""",
        "timestamp": "2025-01-10T18:00:00Z",
        "labels": ["PERSONAL", "INBOX"],
        "category": "fitness"
    }
]

# ============================================================================
# 3. SPAM EMAILS - Realistic Spam
# ============================================================================

spam_emails = [
    {
        "id": "spam_001",
        "from": "winner@lottery-international.biz",
        "to": "sarah.vp@company.com",
        "subject": "CONGRATULATIONS! You've Won $1,000,000!!!",
        "body": """Dear Lucky Winner,

CONGRATULATIONS! You have been selected as the winner of our International Lottery Draw!

Prize Amount: $1,000,000 USD

To claim your prize, please reply with:
- Full Name
- Address
- Bank Account Details

Act now! This offer expires in 48 hours!

International Lottery Commission""",
        "timestamp": "2025-01-06T03:22:00Z",
        "labels": ["SPAM"],
        "spam_score": 0.98
    },
    {
        "id": "spam_002",
        "from": "ceo@company-verify.xyz",
        "to": "sarah.vp@company.com",
        "subject": "URGENT: Verify Your Account Immediately",
        "body": """Dear User,

Your account has been flagged for suspicious activity. Please verify your identity immediately to prevent account suspension.

Click here to verify: [suspicious-link]

Failure to verify within 24 hours will result in permanent account deletion.

Security Team""",
        "timestamp": "2025-01-07T02:45:00Z",
        "labels": ["SPAM"],
        "spam_score": 0.95
    },
    {
        "id": "spam_003",
        "from": "deals@bestpills-online.ru",
        "to": "sarah.vp@company.com",
        "subject": "50% OFF - Premium Supplements - Limited Time!",
        "body": """Amazing deals on premium supplements!

✓ 50% discount
✓ Fast shipping worldwide
✓ No prescription needed

Order now: [link]

This offer won't last!""",
        "timestamp": "2025-01-08T05:12:00Z",
        "labels": ["SPAM"],
        "spam_score": 0.97
    },
    {
        "id": "spam_004",
        "from": "investment@crypto-millions.com",
        "to": "sarah.vp@company.com",
        "subject": "Make $5000/day with Crypto Trading Bot",
        "body": """Revolutionary AI Trading Bot!

✓ Guaranteed profits
✓ $5000+ per day
✓ Only 10 spots left!

Join now for early bird discount: $99 (Regular price: $999)

Don't miss this opportunity!

[Join Now]""",
        "timestamp": "2025-01-09T04:30:00Z",
        "labels": ["SPAM"],
        "spam_score": 0.99
    }
]

# ============================================================================
# 4. CALENDAR EVENTS
# ============================================================================

calendar_events = {
    "week1": [
        {
            "id": "event_001",
            "summary": "Q4 Planning with Sales Team",
            "description": "Review Q4 targets and strategy",
            "start": "2025-01-06T09:30:00Z",
            "end": "2025-01-06T10:30:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "john.sales@company.com",
                "team@company.com"
            ],
            "location": "Conference Room A"
        },
        {
            "id": "event_002",
            "summary": "1-on-1 with John (Sales Manager)",
            "description": "Weekly check-in",
            "start": "2025-01-06T14:00:00Z",
            "end": "2025-01-06T14:30:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "john.sales@company.com"
            ],
            "location": "Sarah's Office"
        },
        {
            "id": "event_003",
            "summary": "Emergency Call - Acme Corp",
            "description": "Production issue resolution",
            "start": "2025-01-07T11:00:00Z",
            "end": "2025-01-07T12:00:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "tom.anderson@acmecorp.com",
                "mike.stevens@company.com"
            ],
            "location": "Zoom",
            "status": "urgent"
        },
        {
            "id": "event_004",
            "summary": "Budget Review Meeting",
            "description": "Q1 budget planning",
            "start": "2025-01-07T14:00:00Z",
            "end": "2025-01-07T15:00:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "maria.finance@company.com",
                "cfo@company.com"
            ],
            "location": "Conference Room B"
        },
        {
            "id": "event_005",
            "summary": "On-site Visit - TechFlow Inc",
            "description": "Contract renewal discussion",
            "start": "2025-01-08T16:00:00Z",
            "end": "2025-01-08T17:30:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "jennifer.martinez@techflow.com"
            ],
            "location": "TechFlow Office, 123 Tech Street"
        },
        {
            "id": "event_006",
            "summary": "Strategy Review",
            "description": "2025 strategic initiatives",
            "start": "2025-01-08T10:00:00Z",
            "end": "2025-01-08T11:30:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "ceo@company.com",
                "leadership@company.com"
            ],
            "location": "Executive Boardroom"
        },
        {
            "id": "event_007",
            "summary": "Quarterly Review - Global Systems",
            "description": "Q4 performance and 2025 planning",
            "start": "2025-01-09T14:00:00Z",
            "end": "2025-01-09T15:00:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "robert.kim@globalsystems.com"
            ],
            "location": "Zoom"
        },
        {
            "id": "event_008",
            "summary": "Product Demo - DataCorp",
            "description": "Demo new features and discuss pricing",
            "start": "2025-01-10T10:00:00Z",
            "end": "2025-01-10T11:00:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "amanda.foster@datacorp.com",
                "sales@company.com"
            ],
            "location": "Zoom"
        },
        {
            "id": "event_009",
            "summary": "Team Happy Hour",
            "description": "Celebrate Q4 success",
            "start": "2025-01-10T17:00:00Z",
            "end": "2025-01-10T19:00:00Z",
            "attendees": [
                "sarah.vp@company.com",
                "team@company.com"
            ],
            "location": "Murphy's Bar"
        }
    ],
    "personal": [
        {
            "id": "event_010",
            "summary": "Dentist Appointment",
            "description": "Regular checkup",
            "start": "2025-01-07T08:00:00Z",
            "end": "2025-01-07T09:00:00Z",
            "attendees": ["sarah.vp@company.com"],
            "location": "Downtown Dental"
        },
        {
            "id": "event_011",
            "summary": "Emma's Soccer Practice",
            "description": "Drop-off and pick-up",
            "start": "2025-01-08T18:00:00Z",
            "end": "2025-01-08T19:00:00Z",
            "attendees": ["sarah.vp@company.com"],
            "location": "City Park Field 3"
        },
        {
            "id": "event_012",
            "summary": "Personal Training",
            "description": "Upper body and core workout",
            "start": "2025-01-11T07:00:00Z",
            "end": "2025-01-11T08:00:00Z",
            "attendees": ["sarah.vp@company.com"],
            "location": "Fitness Studio"
        },
        {
            "id": "event_013",
            "summary": "Sunday Brunch with Parents",
            "description": "Family brunch",
            "start": "2025-01-12T11:00:00Z",
            "end": "2025-01-12T13:00:00Z",
            "attendees": ["sarah.vp@company.com"],
            "location": "Home"
        }
    ]
}


# ============================================================================
# SAVE ALL DATA TO JSON FILES
# ============================================================================

def save_data_to_files():
    """Save all email and calendar data to JSON files"""

    # Save work emails by day
    with open('work_emails.json', 'w', encoding='utf-8') as f:
        json.dump(work_emails, f, indent=2, ensure_ascii=False)

    # Save personal emails
    with open('personal_emails.json', 'w', encoding='utf-8') as f:
        json.dump(personal_emails, f, indent=2, ensure_ascii=False)

    # Save spam emails
    with open('spam_emails.json', 'w', encoding='utf-8') as f:
        json.dump(spam_emails, f, indent=2, ensure_ascii=False)

    # Save calendar events
    with open('calendar_events.json', 'w', encoding='utf-8') as f:
        json.dump(calendar_events, f, indent=2, ensure_ascii=False)

    print("✅ All data files created successfully!")
    print("   - work_emails.json")
    print("   - personal_emails.json")
    print("   - spam_emails.json")
    print("   - calendar_events.json")


if __name__ == "__main__":
    save_data_to_files()