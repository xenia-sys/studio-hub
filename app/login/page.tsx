import LoginForm from './LoginForm';
import { applicationConfigured } from '../../lib/config';

export const dynamic = 'force-dynamic';
export default function LoginPage() {
  return <main className="login-shell"><section className="login-card"><span className="eyebrow">STUDIO HUB · PRIVATE WORKSPACE</span><h1>Mở không gian<br />của studio.</h1><p>Đăng nhập bằng tài khoản đã được chủ studio cấp quyền.</p>{applicationConfigured() ? <LoginForm /> : <div className="notice">Studio Hub đang được thiết lập. Vui lòng quay lại sau.</div>}<small>CRM, vận hành và tài chính trong cùng một nơi.</small></section></main>;
}
