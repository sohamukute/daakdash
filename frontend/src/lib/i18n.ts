// Multilingual UI. English is the source: every user facing string is written in English and
// passed to t(). A dictionary maps that English string to other Indian languages; anything not
// translated falls back to the English source, so the app is always readable.

export type Lang = "en" | "hi" | "mr" | "ta" | "bn" | "te";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "mr", label: "मराठी" },
  { code: "ta", label: "தமிழ்" },
  { code: "bn", label: "বাংলা" },
  { code: "te", label: "తెలుగు" },
];

type Dict = Record<string, string>;

const hi: Dict = {
  "Track a parcel": "पार्सल ट्रैक करें",
  "Track": "ट्रैक करें",
  "Tracking number": "ट्रैकिंग नंबर",
  "Login": "लॉग इन",
  "Log in": "लॉग इन",
  "Register": "रजिस्टर करें",
  "Log out": "लॉग आउट",
  "Email": "ईमेल",
  "Password": "पासवर्ड",
  "Seller": "विक्रेता",
  "Admin": "एडमिन",
  "City Depot": "सिटी डिपो",
  "Delivery Partner": "डिलीवरी पार्टनर",
  "Import your backlog": "अपने ऑर्डर अपलोड करें",
  "Book a parcel": "पार्सल बुक करें",
  "My parcels": "मेरे पार्सल",
  "Item": "वस्तु",
  "Quantity": "मात्रा",
  "Receiver name": "प्राप्तकर्ता का नाम",
  "Receiver phone": "प्राप्तकर्ता का फ़ोन",
  "Delivery address": "डिलीवरी पता",
  "From city": "किस शहर से",
  "To city": "किस शहर तक",
  "Book": "बुक करें",
  "In progress": "प्रगति में",
  "Delivered": "डिलीवर हो गया",
  "Inbound": "आने वाले पार्सल",
  "Scan in": "स्कैन इन",
  "Ready to dispatch": "भेजने के लिए तैयार",
  "Dispatch": "भेजें",
  "Incoming batches": "आने वाले बैच",
  "Mark arrived": "पहुँचा हुआ चिह्नित करें",
  "Go online": "ऑनलाइन जाएँ",
  "Go offline": "ऑफ़लाइन जाएँ",
  "My deliveries": "मेरी डिलीवरी",
  "Call": "कॉल करें",
  "Receiver absent": "प्राप्तकर्ता नहीं मिला",
  "Enter OTP": "ओटीपी दर्ज करें",
  "purani daak, nayi raftaar": "पुरानी डाक, नई रफ़्तार",
  "Booked": "बुक किया गया",
  "At origin depot": "मूल डिपो पर",
  "Sorted": "छँटाई हुई",
  "In transit": "रास्ते में",
  "At destination depot": "गंतव्य डिपो पर",
  "Out for delivery": "डिलीवरी के लिए निकला",
  "by train": "ट्रेन से",
  "by truck": "ट्रक से",
  "parcels": "पार्सल",
  "Every parcel, delivered honestly.": "हर पार्सल, ईमानदारी से पहुँचाया गया।",
  "From your city depot to their door.": "आपके सिटी डिपो से उनके दरवाज़े तक।",
};

const mr: Dict = {
  "Track a parcel": "पार्सल ट्रॅक करा", "Track": "ट्रॅक करा", "Tracking number": "ट्रॅकिंग क्रमांक",
  "Login": "लॉग इन", "Log in": "लॉग इन", "Register": "नोंदणी करा", "Log out": "लॉग आउट",
  "Email": "ईमेल", "Password": "पासवर्ड", "Seller": "विक्रेता", "Admin": "अ‍ॅडमिन",
  "City Depot": "सिटी डेपो", "Delivery Partner": "डिलिव्हरी पार्टनर", "Book": "बुक करा",
  "My parcels": "माझे पार्सल", "Dispatch": "पाठवा", "Go online": "ऑनलाइन व्हा",
  "purani daak, nayi raftaar": "जुनी डाक, नवी गती",
};

const ta: Dict = {
  "Track a parcel": "பார்சலை கண்காணி", "Track": "கண்காணி", "Tracking number": "கண்காணிப்பு எண்",
  "Login": "உள்நுழை", "Log in": "உள்நுழை", "Register": "பதிவு செய்", "Log out": "வெளியேறு",
  "Email": "மின்னஞ்சல்", "Password": "கடவுச்சொல்", "Seller": "விற்பனையாளர்", "Admin": "நிர்வாகி",
  "City Depot": "நகர கிடங்கு", "Delivery Partner": "டெலிவரி பார்ட்னர்", "Book": "பதிவு செய்",
  "My parcels": "என் பார்சல்கள்", "Dispatch": "அனுப்பு", "Go online": "ஆன்லைனில் வா",
};

const bn: Dict = {
  "Track a parcel": "পার্সেল ট্র্যাক করুন", "Track": "ট্র্যাক", "Tracking number": "ট্র্যাকিং নম্বর",
  "Login": "লগ ইন", "Log in": "লগ ইন", "Register": "নিবন্ধন", "Log out": "লগ আউট",
  "Email": "ইমেল", "Password": "পাসওয়ার্ড", "Seller": "বিক্রেতা", "Admin": "অ্যাডমিন",
  "City Depot": "সিটি ডিপো", "Delivery Partner": "ডেলিভারি পার্টনার", "Book": "বুক করুন",
  "My parcels": "আমার পার্সেল", "Dispatch": "পাঠান", "Go online": "অনলাইনে যান",
};

const te: Dict = {
  "Track a parcel": "పార్శిల్‌ను ట్రాక్ చేయండి", "Track": "ట్రాక్", "Tracking number": "ట్రాకింగ్ నంబర్",
  "Login": "లాగిన్", "Log in": "లాగిన్", "Register": "నమోదు", "Log out": "లాగ్ అవుట్",
  "Email": "ఇమెయిల్", "Password": "పాస్‌వర్డ్", "Seller": "విక్రేత", "Admin": "అడ్మిన్",
  "City Depot": "సిటీ డిపో", "Delivery Partner": "డెలివరీ పార్టనర్", "Book": "బుక్ చేయండి",
  "My parcels": "నా పార్శిళ్లు", "Dispatch": "పంపండి", "Go online": "ఆన్‌లైన్‌కి వెళ్లండి",
};

const DICTS: Record<Lang, Dict> = { en: {}, hi, mr, ta, bn, te };

export function translate(lang: Lang, english: string): string {
  if (lang === "en") return english;
  return DICTS[lang][english] ?? english;
}
