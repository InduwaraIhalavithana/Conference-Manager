"""Email wording in English, Sinhala and Tamil. Keys must match across languages (a test checks this)."""
from __future__ import annotations

from datetime import date

TEXT: dict[str, dict[str, str]] = {
    "en": {
        "greeting": "Hello {name},",
        "team_sign": "The ConferenceHub team",
        "footer": "You received this email because of activity on ConferenceHub.",
        "label_date": "Date",
        "label_time": "Time",
        "label_venue": "Venue",
        "label_ticket": "Ticket code",
        "reg_subject": "You're registered: {title}",
        "reg_heading": "Registration confirmed",
        "reg_intro": "You have a seat at {title}. Show the QR code on your ticket at the entrance.",
        "btn_ticket": "View my ticket",
        "wait_subject": "You're on the waitlist: {title}",
        "wait_heading": "You're on the waitlist",
        "wait_intro": "{title} is full right now. You are number {position} on the waitlist, and we will email you as soon as a seat opens.",
        "promo_subject": "A seat opened up: {title}",
        "promo_heading": "You're in!",
        "promo_intro": "A seat became free and it is now yours. Your ticket is ready.",
        "remind_subject": "Tomorrow: {title}",
        "remind_heading": "See you tomorrow",
        "remind_intro": "This is a reminder that {title} starts tomorrow. Bring your ticket QR code for a quick check-in.",
        "newreg_subject": "New registration for {title}",
        "newreg_heading": "New registration",
        "newreg_intro": "{attendee} just registered for {title}. You now have {count} registered attendees.",
        "fb_subject": "Reply to your feedback: {subject}",
        "fb_heading": "The admin team replied",
        "fb_intro": "Here is the reply to your message \"{subject}\":",
        "reset_subject": "Reset your ConferenceHub password",
        "reset_heading": "Reset your password",
        "reset_intro": "Someone asked to reset the password for this account. The link works for 2 hours. If it was not you, ignore this email.",
        "btn_reset": "Choose a new password",
        "btn_dashboard": "Open my dashboard",
    },
    "si": {
        "greeting": "ආයුබෝවන් {name},",
        "team_sign": "ConferenceHub කණ්ඩායම",
        "footer": "ConferenceHub හි සිදු වූ ක්‍රියාකාරකමක් නිසා මෙම ඊමේල් පණිවිඩය ඔබට ලැබුණි.",
        "label_date": "දිනය",
        "label_time": "වේලාව",
        "label_venue": "ස්ථානය",
        "label_ticket": "ප්‍රවේශපත්‍ර කේතය",
        "reg_subject": "ඔබ ලියාපදිංචි විය: {title}",
        "reg_heading": "ලියාපදිංචිය තහවුරුයි",
        "reg_intro": "{title} සඳහා ඔබට ආසනයක් වෙන් කර ඇත. ඇතුළු වන විට ඔබේ ප්‍රවේශපත්‍රයේ QR කේතය පෙන්වන්න.",
        "btn_ticket": "මගේ ප්‍රවේශපත්‍රය බලන්න",
        "wait_subject": "ඔබ පොරොත්තු ලැයිස්තුවේ සිටී: {title}",
        "wait_heading": "ඔබ පොරොත්තු ලැයිස්තුවේ සිටී",
        "wait_intro": "{title} දැනට පිරී ඇත. පොරොත්තු ලැයිස්තුවේ ඔබේ අංකය {position} යි. ආසනයක් නිදහස් වූ වහාම අපි ඔබට ඊමේල් කරන්නෙමු.",
        "promo_subject": "ආසනයක් නිදහස් විය: {title}",
        "promo_heading": "ඔබට ආසනයක් ලැබුණා!",
        "promo_intro": "ආසනයක් නිදහස් වූ අතර එය දැන් ඔබගේ ය. ඔබේ ප්‍රවේශපත්‍රය සූදානම්.",
        "remind_subject": "හෙට: {title}",
        "remind_heading": "හෙට හමුවෙමු",
        "remind_intro": "{title} හෙට ආරම්භ වන බව මතක් කිරීමකි. ඉක්මන් ඇතුළුවීම සඳහා ඔබේ ප්‍රවේශපත්‍රයේ QR කේතය රැගෙන එන්න.",
        "newreg_subject": "{title} සඳහා නව ලියාපදිංචියක්",
        "newreg_heading": "නව ලියාපදිංචියක්",
        "newreg_intro": "{attendee} දැන් {title} සඳහා ලියාපදිංචි විය. ඔබට දැන් ලියාපදිංචි සහභාගිවන්නන් {count} දෙනෙක් සිටිති.",
        "fb_subject": "ඔබේ ප්‍රතිචාරයට පිළිතුරක්: {subject}",
        "fb_heading": "පරිපාලක කණ්ඩායම පිළිතුරු දුන්නා",
        "fb_intro": "\"{subject}\" පණිවිඩයට ලැබුණු පිළිතුර මෙන්න:",
        "reset_subject": "ඔබේ ConferenceHub මුරපදය යළි සකසන්න",
        "reset_heading": "මුරපදය යළි සකසන්න",
        "reset_intro": "මෙම ගිණුමේ මුරපදය යළි සැකසීමට ඉල්ලීමක් ලැබුණි. මෙම සබැඳිය පැය 2ක් වලංගු වේ. එය ඔබ නොවේ නම්, මෙම ඊමේල් පණිවිඩය නොසලකා හරින්න.",
        "btn_reset": "නව මුරපදයක් තෝරන්න",
        "btn_dashboard": "මගේ පාලන පුවරුව විවෘත කරන්න",
    },
    "ta": {
        "greeting": "வணக்கம் {name},",
        "team_sign": "ConferenceHub குழு",
        "footer": "ConferenceHub இல் நடந்த ஒரு செயல்பாட்டின் காரணமாக இந்த மின்னஞ்சல் உங்களுக்கு அனுப்பப்பட்டது.",
        "label_date": "தேதி",
        "label_time": "நேரம்",
        "label_venue": "இடம்",
        "label_ticket": "டிக்கெட் குறியீடு",
        "reg_subject": "நீங்கள் பதிவு செய்துள்ளீர்கள்: {title}",
        "reg_heading": "பதிவு உறுதிசெய்யப்பட்டது",
        "reg_intro": "{title} நிகழ்வில் உங்களுக்கு ஓர் இருக்கை ஒதுக்கப்பட்டுள்ளது. நுழைவாயிலில் உங்கள் டிக்கெட்டின் QR குறியீட்டைக் காட்டுங்கள்.",
        "btn_ticket": "என் டிக்கெட்டைப் பார்க்க",
        "wait_subject": "நீங்கள் காத்திருப்புப் பட்டியலில் உள்ளீர்கள்: {title}",
        "wait_heading": "நீங்கள் காத்திருப்புப் பட்டியலில் உள்ளீர்கள்",
        "wait_intro": "{title} தற்போது நிரம்பியுள்ளது. காத்திருப்புப் பட்டியலில் உங்கள் இடம் {position}. இருக்கை கிடைத்தவுடன் உங்களுக்கு மின்னஞ்சல் அனுப்புவோம்.",
        "promo_subject": "இருக்கை கிடைத்துள்ளது: {title}",
        "promo_heading": "உங்களுக்கு இடம் கிடைத்தது!",
        "promo_intro": "ஓர் இருக்கை காலியானது, அது இப்போது உங்களுடையது. உங்கள் டிக்கெட் தயாராக உள்ளது.",
        "remind_subject": "நாளை: {title}",
        "remind_heading": "நாளை சந்திப்போம்",
        "remind_intro": "{title} நாளை தொடங்குகிறது என்பதை நினைவூட்டுகிறோம். விரைவான நுழைவுக்காக உங்கள் டிக்கெட் QR குறியீட்டைக் கொண்டு வாருங்கள்.",
        "newreg_subject": "{title} நிகழ்வுக்கு புதிய பதிவு",
        "newreg_heading": "புதிய பதிவு",
        "newreg_intro": "{attendee} இப்போது {title} நிகழ்வுக்குப் பதிவு செய்துள்ளார். இப்போது உங்களிடம் {count} பதிவு செய்த பங்கேற்பாளர்கள் உள்ளனர்.",
        "fb_subject": "உங்கள் கருத்துக்குப் பதில்: {subject}",
        "fb_heading": "நிர்வாகக் குழு பதிலளித்துள்ளது",
        "fb_intro": "\"{subject}\" என்ற உங்கள் செய்திக்கான பதில்:",
        "reset_subject": "உங்கள் ConferenceHub கடவுச்சொல்லை மீட்டமைக்கவும்",
        "reset_heading": "கடவுச்சொல்லை மீட்டமைக்கவும்",
        "reset_intro": "இந்தக் கணக்கின் கடவுச்சொல்லை மீட்டமைக்கக் கோரிக்கை வந்துள்ளது. இந்த இணைப்பு 2 மணி நேரம் செல்லுபடியாகும். இது நீங்கள் இல்லையென்றால், இந்த மின்னஞ்சலைப் புறக்கணிக்கவும்.",
        "btn_reset": "புதிய கடவுச்சொல்லைத் தேர்வுசெய்க",
        "btn_dashboard": "என் கட்டுப்பாட்டுப் பலகையைத் திற",
    },
}

MONTHS = {
    "en": ["January", "February", "March", "April", "May", "June", "July", "August",
           "September", "October", "November", "December"],
    "si": ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු",
           "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"],
    "ta": ["ஜனவரி", "பிப்ரவரி", "மார்ச்", "ஏப்ரல்", "மே", "ஜூன்", "ஜூலை", "ஆகஸ்ட்",
           "செப்டம்பர்", "அக்டோபர்", "நவம்பர்", "டிசம்பர்"],
}


def lang_or_default(lang: str | None) -> str:
    return lang if lang in TEXT else "en"


def tr(lang: str | None, key: str, **params) -> str:
    return TEXT[lang_or_default(lang)][key].format(**params)


def format_date(d: date, lang: str | None) -> str:
    return f"{d.day} {MONTHS[lang_or_default(lang)][d.month - 1]} {d.year}"
