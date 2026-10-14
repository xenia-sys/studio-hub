import StudioApp from './StudioApp';
import { requireIdentity } from '../lib/auth';
import { getState } from '../lib/service';
import { createWorkspaceStore } from '../lib/supabase/store';
import { applicationConfigured } from '../lib/config';
import { AppError } from '../lib/domain';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!applicationConfigured()) return <SetupNotice />;
  const identity = await requireIdentity();
  try {
    const data = await getState(createWorkspaceStore(), identity, process.env.STUDIO_OWNER_EMAIL || '');
    return <StudioApp initialData={data} />;
  } catch (error) {
    return <div className="full-state"><h1>Chưa thể mở Studio Hub</h1><p>{error instanceof AppError ? error.message : 'Vui lòng thử lại sau.'}</p><a className="button secondary" href="/logout">Đăng xuất</a></div>;
  }
}

function SetupNotice() {
  return <div className="full-state"><h1>Studio Hub</h1><p>Không gian quản lý riêng tư đang được thiết lập.</p><p>Chủ studio cần hoàn tất cấu hình trước khi đăng nhập.</p></div>;
}
