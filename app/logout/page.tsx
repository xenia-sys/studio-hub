import LogoutForm from './LogoutForm';

export const dynamic = 'force-dynamic';
export default function LogoutPage() {
  return <div className="full-state"><h1>Đăng xuất Studio Hub</h1><p>Kết thúc phiên đăng nhập trên thiết bị này.</p><LogoutForm /></div>;
}
