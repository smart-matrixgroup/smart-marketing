import { MessageCircle, Mail, Facebook, Instagram, Music2, Youtube, Linkedin } from 'lucide-react';
// Order follows the hand-drawn wireframe: WhatsApp, Gmail, Facebook, then the rest.
// Lucide has no official brand marks; swap in official brand SVGs from each platform's brand centre for production.

// SMART PVT LTD – official social media profile links
export const COMPANY_LINKS = [
  { id: 'linkedin',  name: 'LinkedIn',  url: 'https://www.linkedin.com/in/smart-pvt-ltd-smart-pvt-ltd-b5b242449/', color: '#0A66C2', Icon: Linkedin },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/matrixgroup.smart/',                        color: '#E1306C', Icon: Instagram },
  { id: 'facebook',  name: 'Facebook',  url: 'https://www.facebook.com/profile.php?id=61593893646038',             color: '#1877F2', Icon: Facebook },
  { id: 'youtube',   name: 'YouTube',   url: 'https://www.youtube.com/@SMARTPVTLTD',                               color: '#FF0000', Icon: Youtube },
  { id: 'tiktok',    name: 'TikTok',    url: 'https://www.tiktok.com/@smart_pvt_ltd',                              color: '#111111', Icon: Music2 },
];

export const PLATFORMS = [
  { id: 'whatsapp',  name: 'WhatsApp',  color: '#25D366', Icon: MessageCircle, note: 'WhatsApp Status cannot be published via the official Business API. This app offers manual sharing. Business messaging needs WhatsApp Business Platform setup (not enabled in this build).' },
  { id: 'gmail',     name: 'Gmail',     color: '#EA4335', Icon: Mail,          note: 'Connect with Google OAuth to send email.' },
  { id: 'facebook',  name: 'Facebook',  color: '#1877F2', Icon: Facebook,      note: 'Publishes text, images and video to Pages with a Page ID and Page access token.',         profileUrl: 'https://www.facebook.com/profile.php?id=61593893646038' },
  { id: 'instagram', name: 'Instagram', color: '#E1306C', Icon: Instagram,     note: 'Needs a Business/Creator account, a linked Facebook Page and Meta app review before publishing is available.', profileUrl: 'https://www.instagram.com/matrixgroup.smart/' },
  { id: 'tiktok',    name: 'TikTok',    color: '#111111', Icon: Music2,        note: 'Needs TikTok Content Posting API approval. Video only.',                                  profileUrl: 'https://www.tiktok.com/@smart_pvt_ltd' },
  { id: 'youtube',   name: 'YouTube',   color: '#FF0000', Icon: Youtube,       note: 'Needs YouTube Data API access and OAuth consent verification. Video only.',               profileUrl: 'https://www.youtube.com/@SMARTPVTLTD' },
  { id: 'linkedin',  name: 'LinkedIn',  color: '#0A66C2', Icon: Linkedin,      note: 'Needs the Share on LinkedIn / Community Management API product.',                         profileUrl: 'https://www.linkedin.com/in/smart-pvt-ltd-smart-pvt-ltd-b5b242449/' },
];
export const PMAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
export const STATUS = { connected: 'Connected', disconnected: 'Disconnected', expired: 'Connection expired' };
export const RESULT = { published: 'Published', manual: 'Manual sharing required', demo: 'Demo: simulated, not posted', config_required: 'Setup required', failed: 'Failed' };
export const LIMITS = { instagram: [2200, 'media'], tiktok: [2200, 'video'], youtube: [5000, 'video'], linkedin: [3000], facebook: [63000] };
