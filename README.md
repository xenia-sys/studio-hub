# Studio Hub

Ứng dụng quản lý studio đa dịch vụ: CRM, dự án/booking, nhân sự/công việc, doanh thu, chi phí, lợi nhuận và dòng tiền. Đây là bản chuyển từ website Sites sang **Next.js + Supabase + Vercel**, giữ cỡ chữ lớn đã được chốt.

## Trạng thái

- Repository `xenia-sys/studio-hub` được công khai theo xác nhận của chủ studio; dữ liệu trong ứng dụng vẫn yêu cầu đăng nhập và được phân quyền.
- Website đã hoạt động: https://studio-hub-eight-coral.vercel.app — đăng nhập bằng tài khoản Studio Hub đã được cấp quyền.
- Supabase project riêng `studio-hub` ở Singapore dùng gói Free; hai migration đã được áp dụng. Tài khoản chủ studio đã được tạo và đăng nhập thử thành công.
- Vercel production đã cấu hình đủ URL, publishable key, `SUPABASE_SECRET_KEY` ở chế độ Secret và email chủ studio. Các cấu hình này chỉ đặt ở production; khóa bí mật không nằm trong Git hoặc JavaScript phía trình duyệt.
- Mã nguồn ứng dụng ở nhánh `development`; PR #1 chứa các thay đổi để review. Vercel ghi nhận commit cụ thể cho mỗi lần triển khai production.
- Website Sites hiện tại hoạt động độc lập; dữ liệu thật và phiên đăng nhập ChatGPT không tự chuyển sang Supabase.
- `vercel.json` tắt tự triển khai từ Git để giữ bước kiểm tra quyền truy cập trước khi phát hành.

## Chức năng

- Dashboard, discovery questionnaire, CRM và lịch chăm sóc khách hàng.
- Dự án theo 7 dịch vụ, booking tài nguyên có kiểm tra trùng giờ, phân công nhân sự/công việc.
- Chi phí phát sinh, khoản thực thu/chi, công nợ, lợi nhuận và dòng tiền; xuất JSON; nhật ký 500 thao tác.
- 4 vai trò do máy chủ kiểm tra: chủ studio, quản lý vận hành, tài chính, chỉ xem.
- Mỗi lần lưu dùng revision để tránh ghi đè thay đổi của người khác.

| Vai trò | CRM / dự án / nhân sự | Hợp đồng | Chi phí / thu chi | Cấu hình / quyền |
| --- | --- | --- | --- | --- |
| Chủ studio | Đọc và sửa | Đọc và sửa | Đọc và sửa | Đọc và sửa |
| Quản lý | Đọc và sửa | Ẩn; không sửa giá trị | Ẩn | Xem hồ sơ |
| Tài chính | Chỉ xem | Chỉ xem | Đọc và sửa | Xem hồ sơ |
| Chỉ xem | Chỉ xem | Ẩn | Ẩn | Xem hồ sơ |

## Thiết lập riêng tư

1. Repository GitHub ở chế độ **Public** theo yêu cầu. Không lưu dữ liệu vận hành thật hoặc khóa bí mật vào mã nguồn.
2. Chọn một Supabase project dành cho Studio Hub. Dự án Supabase đang chứa hệ thống thu mua không phải lựa chọn mặc định.
3. Sau khi chủ sở hữu xác nhận đúng project, chạy các migration trong `supabase/migrations` theo thứ tự qua quy trình migration của Supabase. Migration thêm bảng `studio_hub_workspaces` và thu hồi quyền gọi công khai của hàm RLS tự động nếu Supabase đã tạo hàm này. Không sửa bảng thu mua, không tạo hoặc gửi lời mời cho người dùng.
4. Tạo Vercel project riêng `studio-hub`, framework Next.js, Node.js 22+, region Singapore. Website production cho phép truy cập công khai đến màn hình đăng nhập; dữ liệu chỉ dành cho tài khoản được cấp quyền. Có thể bật Deployment Protection cho preview. Không cần bật Public Source trong Vercel vì mã nguồn đã ở GitHub.
5. Cấu hình trực tiếp trong Vercel 4 biến của `.env.example`: URL, publishable key, secret key chỉ phía server, và email của chủ studio. Không gửi khóa bí mật qua chat hoặc lưu vào Git. Đặt `APP_ORIGIN` nếu dùng một địa chỉ production cố định.
6. Trong Supabase Auth, tắt đăng ký tự do và anonymous sign-in. Tạo tài khoản chủ studio với email đã xác nhận trong dashboard; không cần endpoint đăng ký công khai. Mật khẩu do người dùng thiết lập an toàn trong Supabase.
7. Sau khi liên kết Vercel và kiểm tra đủ biến môi trường, chạy `npm ci`, `npm run check`, rồi `npm run dev` nếu cần thử cục bộ. `.env.local` được Git bỏ qua.
8. Đăng nhập bằng chủ studio để khởi tạo bộ dữ liệu mẫu. Chỉ email `STUDIO_OWNER_EMAIL` mới có thể khởi tạo; người truy cập đầu tiên bất kỳ không được trở thành chủ studio.
9. Khi thêm quản lý: chủ studio khai báo email và vai trò trong Studio Hub; tài khoản đăng nhập được tạo riêng trong Supabase Auth. Ứng dụng không tự gửi email mời. Khóa thành viên có hiệu lực ở lần đọc/ghi kế tiếp, kể cả khi phiên đăng nhập còn hạn.

## Ranh giới quyền truy cập

- `auth.getUser()` xác thực mỗi yêu cầu với Supabase; không tin header nhận dạng từ trình duyệt, không dùng `getSession()` hoặc `user_metadata` làm nguồn quyền.
- `SUPABASE_SECRET_KEY` chỉ dùng trong module `server-only`. Khóa này có quyền database cao và phải được quản lý trong môi trường Vercel.
- Bảng snapshot bật RLS, không có policy cho `anon`/`authenticated`, đồng thời thu hồi quyền table của hai role này. Người dùng không thể bỏ qua API để đọc JSON chứa tài chính qua Supabase REST.
- Máy chủ đọc snapshot, kiểm tra membership, lọc tài chính theo vai trò và thực hiện lưu có điều kiện revision. Máy chủ là nơi kiểm tra quyền sửa dữ liệu.
- POST kiểm tra Origin, JSON và giới hạn 200 KB; phản hồi người dùng là `private, no-store`. SSR không dùng ISR cho trang đăng nhập/dữ liệu.
- Repository và màn hình đăng nhập được công khai. Dữ liệu vận hành không công khai: mỗi lần đọc/ghi đều kiểm tra tài khoản và vai trò. `noindex` không phải cơ chế giới hạn truy cập.

## Kiểm tra

`npm run typecheck`, `npm test`, `npm run build` đều đã chạy thành công trong bản chuẩn bị: 15 tests; production build Next.js 16.4.0. Kiểm tra npm audit cho dependency production không phát hiện lỗ hổng ở thời điểm chạy.

Tests dùng PostgreSQL cục bộ qua PGlite để kiểm tra migration, quyền RLS và revision; các luồng CRM → dự án → cọc → chi phí → hoàn thành, phân quyền, xác thực đầu vào, xử lý xung đột và render 6 màn hình.

Kiểm thử production ngày 14/10/2026:

- Đăng nhập chủ studio, tải lại trang giữ phiên, đăng xuất trở về màn hình đăng nhập.
- Tạo và sửa khách hàng từ giao diện; trạng thái và ghi chú đã lưu vào Supabase, còn nguyên sau khi tải lại trang.
- Ghi chi phí giả lập 190.000đ và thanh toán một phần 100.000đ liên kết đúng chi phí. Đối chiếu database và dashboard: tổng chi phí 31.690.000đ, dòng tiền ròng 34.900.000đ, phải trả 7.090.000đ. Lợi nhuận quản trị 9.310.000đ.
- Dọn đúng ba bản ghi kiểm thử tạm, giữ nguyên các bản ghi khác và lịch sử thao tác; dữ liệu mẫu trở về 6 khách, 7 dự án, 4 nhân sự, 5 công việc, 5 chi phí, 8 khoản thu/chi.
- Khách chưa đăng nhập đến màn hình đăng nhập; `/api/studio` trả 401, không trả dữ liệu workspace. Supabase REST bằng publishable key không đọc được bảng snapshot.
- Security advisor chỉ còn thông tin RLS không có policy (chủ ý chặn truy cập trực tiếp); không còn cảnh báo quyền execute công khai của hàm RLS tự động. Performance advisor không có mục cần xử lý tại thời điểm kiểm tra.

Phân quyền bốn vai trò đã được kiểm tra bằng tests; phiên production thực tế mới kiểm thử với tài khoản chủ studio. Cần thử thêm bằng tài khoản quản lý, tài chính và chỉ xem khi các tài khoản này được tạo. Chưa kiểm thử phiên đăng nhập hết hạn hoặc cơ chế refresh dài hạn.

## Cách tính và giới hạn pilot

- Doanh thu = giá trị toàn bộ hợp đồng khi dự án hoàn thành, theo ngày hoàn thành. Chi phí = khoản đã phát sinh theo ngày phát sinh, gồm chi phí của dự án chưa hoàn thành. Không phân bổ dở dang hoặc chi phí chung vào margin từng dịch vụ.
- Dòng tiền = các khoản thực thu/chi theo ngày giao dịch. Tiền cọc dự án chưa hoàn thành được theo dõi riêng; khoản phải thu chỉ gồm dự án hoàn thành.
- Snapshot JSON dành cho một studio và nhóm nhỏ; giới hạn 5.000 bản ghi/mục, 20 MB snapshot, 500 audit. Mỗi thay đổi lưu lại toàn bộ snapshot; cần schema chuẩn hóa/phân trang trước khi mở rộng.
- Chưa có bảng lương, tồn kho, hoàn tiền, số dư đầu kỳ, VAT/khấu hao, nhập hoặc khôi phục JSON. Xuất JSON là bản sao tải xuống; không thay thế cấu hình backup database.
- Migration tạo schema và bảo vệ hàm nội bộ của Supabase. Không nhập tự động dữ liệu đang lưu ở Sites.

## Tài liệu nguồn

- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
