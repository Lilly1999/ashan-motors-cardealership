// Business details shown across the site. Replace the placeholders with the real values.
// Any social link left as '' is hidden automatically.
export const SITE_CONFIG = {
  // Address of the API server. Leave empty when the API is on the same domain as the site
  // (Vercel, and local development where proxy.conf.json forwards /api to port 3000).
  // Only set this if you host the API somewhere else, e.g. 'https://api.ashanmotors.co.ke'.
  apiBase: '',
  currency: 'KES',
  // International format, digits only (e.g. 254712345678). Used for every WhatsApp button.
  whatsappNumber: '254790991443',
  phoneDisplay: '+254 790 991 443',
  email: 'jimnjoro16@gmail.com',
  location: 'Moi Ave,Mombasa, Kenya',
  hours: 'Mon – Sat, 8:30am – 6:00pm',
  // Handwritten signature shown on the home banner and footer.
  tagline: 'Your Moti Guy',
  about: 'Ashan Motors is a car dealership offering hand-picked, quality vehicles with clear pricing and friendly, straightforward service.',
  instagramUrl: 'https://www.instagram.com/your_moti_guy/',
  tiktokUrl: 'https://www.tiktok.com/@ashanmotorsmsa/',
  youtubeUrl: 'https://www.youtube.com/@Yourmotiguy-l8e/',
};

// Frequently asked questions on the home page. Edit freely to match how the dealership works.
export const FAQS = [
  {
    question: 'How do I enquire about a car?',
    answer: 'Tap "Send inquiry" on any car and WhatsApp opens with the car’s details already filled in. You can also call us or visit the showroom.',
  },
  {
    question: 'Can I see and test drive a car before buying?',
    answer: 'Yes. Message us to book a viewing and test drive at a time that suits you.',
  },
  {
    question: 'Are the prices on the website final?',
    answer: 'Every listing shows its current asking price. Talk to our team for the latest availability and any questions about the price.',
  },
  {
    question: 'How often do you add new cars?',
    answer: 'New stock is added regularly. Check the New Arrivals section, or follow us on Instagram, TikTok and YouTube to see cars as soon as they land.',
  },
  {
    question: 'What happens when a car is marked as sold?',
    answer: 'Sold cars stay on the site for reference. If you liked one, message us and we will help you find something similar.',
  },
];
