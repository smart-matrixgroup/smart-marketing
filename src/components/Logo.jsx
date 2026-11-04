import logo from '../assets/logo.jpg';

export default function Logo({ size = 44 }) {
  return <img src={logo} width={size} height={size} alt="SMART" style={{ objectFit: 'contain', borderRadius: 12 }} />;
}