// إعدادات Supabase — مصدر واحد فقط (كان مكررًا داخل index.html).
// مفتاح anon عام بطبيعته ولا يعطي أي وصول بعد تشغيل secure-auth-migration.sql
// (كل السياسات تتطلب مستخدمًا مسجّلًا). لا تضع service_role هنا أبدًا.
//
// Single source of truth for Supabase settings. The anon key is public by design and
// grants nothing once secure-auth-migration.sql is applied. NEVER put service_role here.
window.SUPABASE_CONFIG = {
  url: 'https://jmwkkpiddnlfucgejmpd.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imptd2trcGlkZG5sZnVjZ2VqbXBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgxNjUwNjksImV4cCI6MjEwMzc0MTA2OX0.wgPv9jx05jAj4p1eNx6-_p23EqIDc04PNRWHQ83CK0A',
  // نطاق البريد الداخلي الذي يُشتق منه بريد كل اسم مستخدم (يجب أن يطابق AUTH_EMAIL_DOMAIN في الدالة)
  emailDomain: 'daftar-auth.app'
};
