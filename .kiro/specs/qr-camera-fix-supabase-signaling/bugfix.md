# Bugfix Requirements Document

## Introduction

Hệ thống quét QR code và camera hiện tại gặp hai vấn đề nghiêm trọng ảnh hưởng đến trải nghiệm người dùng trên thiết bị di động:

1. **Camera overlay misalignment**: Khung 4 góc scanning overlay (UI) bị lệch so với video stream thực tế, khiến người dùng không thể căn chỉnh QR code đúng vị trí để quét.

2. **QR code quá lớn và phức tạp**: QR code hiện tại chứa toàn bộ WebRTC signal data (SDP offer/answer + ICE candidates) được base64 encode, tạo ra QR code với kích thước >2000 ký tự, rất dày đặc, khó quét và gần như không nhìn thấy trên điện thoại.

Bugfix này sẽ giải quyết cả hai vấn đề bằng cách:
- Sửa lỗi CSS/layout để overlay khớp chính xác với video stream
- Chuyển sang sử dụng Supabase làm signaling relay server, cho phép QR code chỉ chứa room ID ngắn (6-8 ký tự) thay vì toàn bộ signal data

## Bug Analysis

### Current Behavior (Defect)

**Bug 1: Camera Overlay Misalignment**

1.1 WHEN người dùng mở camera để quét QR code trên điện thoại THEN khung 4 góc scanning overlay (UI) bị lệch so với video stream thực tế

1.2 WHEN người dùng cố gắng căn chỉnh QR code vào khung overlay THEN QR code không được quét vì vị trí thực tế của video stream không khớp với UI overlay

**Bug 2: QR Code Too Large**

1.3 WHEN hệ thống tạo QR code chứa WebRTC signal data THEN QR code có kích thước >2000 ký tự, tạo ra mã QR rất dày đặc

1.4 WHEN người dùng cố gắng quét QR code lớn trên điện thoại THEN thời gian quét rất lâu hoặc không quét được do mã QR quá phức tạp

1.5 WHEN người dùng xem QR code trên màn hình điện thoại THEN gần như không nhìn thấy gì vì QR code quá nhỏ và dày đặc

1.6 WHEN hệ thống encode signal data THEN toàn bộ SDP offer/answer và ICE candidates được nhét trực tiếp vào QR code thông qua base64 encoding

### Expected Behavior (Correct)

**Bug 1: Camera Overlay Alignment Fix**

2.1 WHEN người dùng mở camera để quét QR code trên bất kỳ thiết bị nào THEN khung 4 góc scanning overlay SHALL khớp chính xác với video stream thực tế

2.2 WHEN người dùng căn chỉnh QR code vào khung overlay THEN QR code SHALL được quét thành công vì vị trí overlay khớp với video stream

**Bug 2: QR Code Size Reduction via Supabase Signaling**

2.3 WHEN hệ thống tạo QR code THEN QR code SHALL chỉ chứa room ID ngắn (6-8 ký tự) thay vì toàn bộ signal data

2.4 WHEN người dùng quét QR code mới THEN thời gian quét SHALL nhanh và dễ dàng do QR code đơn giản (<100 ký tự)

2.5 WHEN người dùng xem QR code trên màn hình điện thoại THEN QR code SHALL rõ ràng và dễ nhìn

2.6 WHEN Sender tạo WebRTC offer THEN hệ thống SHALL lưu offer vào Supabase và tạo room ID ngắn

2.7 WHEN Receiver quét QR code chứa room ID THEN hệ thống SHALL lấy offer từ Supabase, tạo answer và gửi answer về Supabase

2.8 WHEN Sender poll answer từ Supabase THEN hệ thống SHALL hoàn tất WebRTC connection

2.9 WHEN signal data được lưu vào Supabase THEN hệ thống SHALL tự động xóa data sau 5 phút hoặc khi connection thành công

2.10 WHEN có request tạo room hoặc truy cập signal data THEN hệ thống SHALL implement rate limiting để tránh spam/DoS

2.11 WHEN có request truy cập signal data THEN hệ thống SHALL implement Row Level Security (RLS) policies để bảo mật

2.12 WHEN có input từ user (room ID, signal data) THEN hệ thống SHALL validate để tránh injection attacks

### Unchanged Behavior (Regression Prevention)

3.1 WHEN WebRTC connection được thiết lập THEN file transfer SHALL CONTINUE TO hoạt động P2P (file không qua Supabase)

3.2 WHEN người dùng gửi file qua WebRTC data channel THEN chunked file transfer protocol SHALL CONTINUE TO hoạt động như hiện tại

3.3 WHEN người dùng sử dụng mini chat THEN chat messages SHALL CONTINUE TO được gửi qua WebRTC data channel

3.4 WHEN người dùng cancel transfer THEN cancel logic SHALL CONTINUE TO hoạt động như hiện tại

3.5 WHEN WebRTC connection bị disconnect THEN cleanup logic SHALL CONTINUE TO hoạt động như hiện tại

3.6 WHEN người dùng sử dụng copy/paste signal thay vì QR code THEN manual signaling flow SHALL CONTINUE TO hoạt động (với signal data từ Supabase thay vì embedded)

3.7 WHEN camera không khả dụng hoặc bị lỗi THEN error handling và fallback logic SHALL CONTINUE TO hoạt động như hiện tại
