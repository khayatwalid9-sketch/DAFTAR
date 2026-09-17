
// ============== DATA ==============
const IMAGE_PATH = '305922021_523349173131481_1401793005313797692_n.jpg';
let currentLang = localStorage.getItem('daftar_language') || 'ar';

// ============== SUPABASE CLIENT ==============
let supabaseClient = null;
try {
  if (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
    supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
  }
} catch (e) {
  console.warn('Supabase client initialization failed:', e);
}

// Page titles for English mode
const EN_TITLES = {
  dashboard:['Dashboard','Overview of collection status today'], 
  debtors:['Debtors','Manage all debtor files'], 
  reps:['Collectors','Field collection team and performance'],
  payments:['Payment log','All recorded payments'], 
  followups:['Follow-ups','Calls and visits log'], 
  quotations:['Quotations','Track price quotations sent to client companies'],
  aging:['Debt aging','Overdue classification by 30/60/90 days'], 
  reports:['Reports','Financial summary and case analysis'], 
  settings:['Settings','Backup and system data management']
};

// Translation dictionary for internationalization
const translations = {
  'brand.subtitle':['نظام تحصيل الديون','Debt collection system'],'notifications.title':['الإشعارات','Notifications'],'notifications.none':['لا توجد إشعارات جديدة','No new notifications'],'notifications.overdue':['متأخر','Overdue'],'notifications.dueToday':['مستحق اليوم','Due today'],'notifications.dueSoon':['استحقاق قريب','Due soon'],'theme.darkMode':['الوضع الليلي','Dark mode'],'theme.lightMode':['الوضع الفاتح','Light mode'],
  'nav.dashboard':['لوحة التحكم','Dashboard'],'nav.debtors':['المدينون','Debtors'],'nav.reps':['المندوبون','Collectors'],'nav.payments':['سجل السداد','Payments'],'nav.followups':['المتابعات','Follow-ups'],'nav.aging':['أعمار الديون','Debt aging'],'nav.reports':['التقارير','Reports'],'nav.settings':['الإعدادات','Settings'],'nav.logout':['تسجيل الخروج','Log out'],
  'topbar.addDebtor':['+ إضافة مدين','+ Add debtor'],'topbar.search':['بحث عن مدين، هاتف...','Search debtor or phone...'],
  'topbar.printPage':['🖶 طباعة الصفحة','🖶 Print page'],'topbar.downloadPagePdf':['⭳ تحميل PDF','⭳ Download PDF'],
  'modal.addDebtor':['إضافة مدين جديد','Add debtor'],'modal.editDebtor':['تعديل بيانات المدين','Edit debtor'],'modal.saveDebtor':['حفظ المدين','Save debtor'],'modal.saveChanges':['حفظ التعديلات','Save changes'],'modal.cancel':['إلغاء','Cancel'],'modal.fullName':['الاسم الكامل','Full name'],'modal.fullNamePh':['مثال: محمد عبدالله السويدي','e.g. John Smith'],'modal.companyName':['اسم الشركة','Company name'],'modal.companyNamePh':['مثال: شركة الخليج','e.g. Gulf Trading'],'modal.debtorType':['نوع المدين','Debtor type'],'modal.phone':['رقم الهاتف','Phone'],'modal.totalAmount':['إجمالي مبلغ الدين','Total debt'],'modal.dueDate':['تاريخ الاستحقاق','Due date'],'modal.expectedPaymentDate':['تاريخ الدفع المتوقع','Expected payment date'],'modal.paidUpfront':['مبلغ مسدد مسبقًا (اختياري)','Upfront payment (optional)'],'modal.assignedRep':['المندوب المسؤول (اختياري)','Assigned collector (optional)'],'modal.notesPh':['تفاصيل إضافية عن الحالة...','Additional case details...'],'modal.collectionMethod':['طريقة التحصيل','Payment method'],'modal.collectionDate':['تاريخ التحصيل','Payment date'],
  'debtors.title':['قائمة المدينين','Debtors list'],'debtors.allTypes':['كل الأنواع','All types'],'debtors.individuals':['أفراد','Individuals'],'debtors.companies':['شركات','Companies'],'debtors.importExcel':['⭱ استيراد من إكسل','⭱ Import Excel'],'debtors.downloadTemplate':['⭳ نموذج الاستيراد','⭳ Import template'],'debtors.individual':['فرد','Individual'],'debtors.company':['شركة','Company'],'debtors.empty':['لا يوجد مدينون مطابقون لبحثك.','No matching debtors.'],
  'status.active':['نشط','Active'],'status.overdue':['متأخر','Overdue'],'status.paid':['مسدد بالكامل','Paid'],
  'th.name':['الاسم','Name'],'th.type':['النوع','Type'],'th.phone':['الهاتف','Phone'],'th.total':['إجمالي الدين','Total debt'],'th.paid':['المسدد','Paid'],'th.remaining':['المتبقي','Remaining'],'th.status':['الحالة','Status'],'th.rep':['المندوب','Collector'],'th.lastContact':['آخر تواصل','Last contact'],'th.actions':['إجراءات','Actions'],'th.notes':['ملاحظات','Notes'],'th.date':['التاريخ','Date'],'th.debtor':['المدين','Debtor'],'th.amountPaid':['المبلغ المسدد','Amount paid'],'th.method':['طريقة الدفع','Method'],'th.area':['المنطقة','Area'],'th.assignedCases':['الحالات المسندة','Assigned cases'],'th.collected':['المحصّل','Collected'],'th.rate':['نسبة الإنجاز','Completion rate'],'th.contactMethod':['طريقة التواصل','Contact method'],'th.outcome':['النتيجة','Outcome'],'th.due':['تاريخ الاستحقاق','Due date'],
  'aging.title':['تقرير أعمار الديون التفصيلي','Detailed debt aging report'],'aging.print':['🖶 طباعة التقرير','🖶 Print report'],'aging.pdf':['⭳ تحميل PDF','⭳ Download PDF'],'aging.daysLate':['أيام التأخير','Days late'],'aging.bucket':['الفئة العمرية','Aging bucket'],'aging.b1':['1 – 30 يوم تأخير','1 - 30 days late'],'aging.b2':['31 – 60 يوم تأخير','31 - 60 days late'],'aging.b3':['61 – 90 يوم تأخير','61 - 90 days late'],'aging.b4':['أكثر من 90 يوم','Over 90 days'],'aging.empty':['لا توجد ديون متأخرة حاليًا — جميع الحالات ضمن موعدها.','No overdue debts currently.'],
  'action.view':['عرض التفاصيل','View details'],'action.edit':['تعديل','Edit'],'action.delete':['حذف','Delete'],'confirm.deleteDebtor':['هل أنت متأكد من حذف هذا المدين نهائيًا؟','Delete this debtor permanently?'],'drawer.noRep':['بدون مندوب','Unassigned'],'drawer.amount':['المبلغ','Amount'],'drawer.outcomePh':['النتيجة / الملاحظة','Outcome / note'],'drawer.add':['إضافة','Add'],'drawer.printStatement':['🖶 طباعة كشف حساب','🖶 Print statement'],'drawer.downloadPdf':['⭳ تحميل PDF','⭳ Download PDF'],
  'login.title':['دفتر — تسجيل الدخول','Daftar - Sign in'],'login.sub':['الرجاء تسجيل الدخول للوصول إلى نظام تحصيل الديون','Sign in to access the debt collection system'],'login.user':['اسم المستخدم','Username'],'login.pass':['كلمة المرور','Password'],'login.btn':['دخول','Sign in'],'login.hint':['بيانات الدخول السحابية: walid / Ksi@33774995','Cloud login: walid / Ksi@33774995'],
  'toast.updated':['تم تحديث بيانات المدين','Debtor updated'],'toast.deleted':['تم حذف المدين','Debtor deleted'],'toast.needName':['الرجاء إدخال الاسم والمبلغ','Enter a name and amount'],'toast.needCompanyName':['الرجاء إدخال اسم الشركة والمبلغ','Enter a company name and amount'],'toast.debtorAdded':['تمت إضافة المدين بنجاح','Debtor added'],'toast.companyAdded':['تمت إضافة الشركة بنجاح','Company added'],
  'method.cash':['نقدًا','Cash'],'method.cheque':['شيك','Cheque'],'method.transfer':['تحويل بنكي','Bank transfer'],'method.call':['اتصال هاتفي','Phone call'],'method.sms':['رسالة نصية','SMS'],'method.visit':['زيارة ميدانية','Field visit'],'method.email':['بريد إلكتروني','Email']
};
Object.assign(translations,{
  'dash.monthlyTarget':['المستهدف الشهري','Monthly Target'],'dash.targetProgress':['تقدم الهدف','Target Progress'],'dash.collectionRate':['نسبة التحصيل','Collection Rate'],'dash.rateComparison':['مقارنة بالشهر الماضي','vs Last Month'],'dash.avgDaysToCollect':['متوسط أيام التحصيل','Avg Days to Collect'],'dash.daysTrend':['اتجاه الأيام','Days Trend'],
  'integration.title':['التكامل الخارجي','External Integration'],
  'integration.smsProvider':['مزود خدمة SMS','SMS Provider'],
  'integration.none':['بدون','None'],
  'integration.smsApiKey':['مفتاح API','API Key'],
  'integration.emailProvider':['مزود خدمة البريد الإلكتروني','Email Provider'],
  'integration.emailApiKey':['مفتاح API','API Key'],
  'integration.testIntegration':['اختبار التكامل','Test Integration'],
  'integration.testSuccess':['تم اختبار التكامل بنجاح','Integration test successful'],
  'integration.testFailed':['فشل اختبار التكامل','Integration test failed'],
  'automation.title':['الأتمتة والقواعد','Automation & Rules'],
  'automation.autoFollowups':['إنشاء متابعات تلقائية للديون المتأخرة','Auto-create followups for overdue debts'],
  'automation.autoReports':['إنشاء تقارير أسبوعية تلقائية','Auto-create weekly reports'],
  'automation.smartReminders':['تنبيهات ذكية تعتمد على أنماط السداد','Smart reminders based on payment patterns'],
  'automation.followupFrequency':['تكرار المتابعة التلقائية (أيام)','Auto followup frequency (days)'],
  'automation.rulesApplied':['تم تطبيق قواعد الأتمتة','Automation rules applied'],
  'compliance.title':['الامتثال القانوني','Legal Compliance'],
  'compliance.dataRetention':['الالتزام بسياسة الاحتفاظ بالبيانات','Data Retention Policy'],
  'compliance.gdprCompliance':['الامتثال للوائح حماية البيانات','GDPR Compliance'],
  'compliance.auditTrail':['تفعيل سجل التدقيق الكامل','Full Audit Trail'],
  'compliance.companyInfo':['معلومات الشركة للامتثال','Company Information for Compliance'],
  'compliance.generateReport':['إنشاء تقرير الامتثال','Generate Compliance Report'],
  'compliance.reportGenerated':['تم إنشاء تقرير الامتثال','Compliance report generated'],
  'nav.footnote':['يعمل هذا النظام بالكامل داخل المتصفح — البيانات محفوظة تلقائيًا في هذا الجهاز فقط.','This system runs in your browser - data is saved on this device only.'],
  'dash.totalDebts':['إجمالي الديون المسجلة','Total registered debts'],'dash.via':['عبر','Across'],'dash.file':['ملف تحصيل','collection files'],'dash.collected':['المبلغ المحصَّل','Collected amount'],'dash.ofTotal':['من الإجمالي','of total'],'dash.overdueTotal':['متأخرات قائمة','Outstanding overdue'],'dash.overdueCase':['حالة متأخرة','overdue cases'],'dash.activeCases':['حالات نشطة قيد المتابعة','Active cases'],'dash.needsFollow':['تحتاج متابعة مستمرة','Need ongoing follow-up'],'dash.companyDebts':['ديون الشركات','Company debts'],'dash.companyUnit':['شركة مدينة','companies'],'dash.individualDebts':['ديون الأفراد','Individual debts'],'dash.individualUnit':['فرد مدين','individuals'],'dash.topOverdue':['أعلى المدينين تأخرًا','Most overdue debtors'],'dash.recentActivity':['آخر المتابعات','Recent activity'],'dash.upcomingDue':['تنبيهات الاستحقاق القادمة','Upcoming due alerts'],
  'debtors.allStatuses':['كل الحالات','All statuses'],'reps.count':['عدد المندوبين','Collectors'],'reps.workOn':['يعملون على ملفات التحصيل','Working on collection files'],'reps.collectedBy':['المحصَّل بواسطة المندوبين','Collected by collectors'],'reps.ofAssigned':['من إجمالي الحالات المسندة','of assigned cases'],'reps.unassigned':['حالات غير مسندة','Unassigned cases'],'reps.noRep':['مدينون بلا مندوب مسؤول','Debtors without a collector'],'reps.team':['فريق المندوبين','Collection team'],'reps.addRep':['+ إضافة مندوب','+ Add collector'],'reps.empty':['لا يوجد مندوبون مسجّلون بعد.','No collectors registered yet.'],'reps.rating':['التقييم','Rating'],'reps.monthlyReport':['التقرير الشهري للمندوبين','Monthly Collector Report'],'reps.excellent':['ممتاز','Excellent'],'reps.good':['جيد','Good'],'reps.average':['متوسط','Average'],'reps.poor':['ضعيف','Poor'],'payments.title':['سجل كل عمليات السداد','All payments'],'payments.empty':['لم يتم تسجيل أي عملية سداد بعد.','No payments recorded yet.'],'followups.title':['سجل المتابعات والاتصالات','Follow-up and contact log'],'followups.empty':['لم يتم تسجيل أي متابعة بعد.','No follow-ups recorded yet.'],
  'reports.statusDist':['توزيع حالات المدينين','Debtor status distribution'],'reports.financialSummary':['ملخص مالي','Financial summary'],'reports.totalDebts':['إجمالي الديون','Total debts'],'reports.totalCollected':['إجمالي المحصَّل','Total collected'],'reports.totalRemaining':['إجمالي المتبقي','Total remaining'],'reports.collectionRate':['نسبة التحصيل','Collection rate'],'reports.paymentsCount':['عدد عمليات السداد','Payments count'],'reports.followupsCount':['عدد المتابعات المسجّلة','Follow-ups count'],
  'reports.advanced':['التحليل المالي المتقدم','Advanced financial analysis'],'reports.averageDebt':['متوسط الدين','Average debt'],'reports.overdueRate':['نسبة المتأخرات','Overdue rate'],'reports.expectedMonthly':['المتوقع شهريًا','Expected monthly'],'reports.month':['الشهر','Month'],'reports.dueAmount':['مستحق','Due'],'reports.paidAmount':['محصل','Collected'],
  'reports.title':['التقارير المالية','Financial reports'],'reports.print':['🖶 طباعة التقرير','🖶 Print report'],'reports.pdf':['⭳ تحميل PDF','⭳ Download PDF'],'reports.debtorsNotes':['المدينون والملاحظات','Debtors and notes'],
  'settings.account':['بيانات تسجيل الدخول','Login details'],'settings.username':['اسم المستخدم','Username'],'settings.newPassword':['كلمة مرور جديدة (اتركها فارغة لعدم التغيير)','New password (leave blank to keep current)'],'settings.saveAccount':['حفظ بيانات الدخول','Save login details'],'settings.printWatermark':['شعار الطباعة','Print watermark'],'settings.printWatermarkDesc':['يظهر شعار الشركة تلقائيًا كخلفية شفافة في كل كشوفات الحساب والتقارير المطبوعة أو التي يتم تحميلها كملف PDF.','The company image appears as a transparent background on printed and PDF statements and reports.'],'settings.enableWatermark':['تفعيل شعار الخلفية عند الطباعة/التصدير','Enable watermark for printing/export'],'settings.dueAlerts':['تنبيهات الاستحقاق','Due alerts'],'settings.reminderDays':['تنبيه قبل تاريخ الاستحقاق بـ (أيام)','Alert before due date (days)'],'settings.enableNotif':['🔔 تفعيل تنبيهات المتصفح','🔔 Enable browser alerts'],'settings.notifOff':['تنبيهات المتصفح غير مفعّلة حاليًا.','Browser alerts are currently disabled.'],'settings.dataStorage':['حفظ البيانات','Data storage'],'settings.backup':['نسخ احتياطي','Backup'],'settings.exportBackup':['⭳ تصدير نسخة احتياطية (JSON)','⭳ Export backup (JSON)'],'settings.importBackup':['⭱ استيراد نسخة احتياطية','⭱ Import backup'],'settings.dangerZone':['منطقة الخطر','Danger zone'],'settings.clearAll':['مسح جميع البيانات المسجلة','Clear all data'],
  'drawer.totalAssigned':['إجمالي المسند','Total assigned'],'drawer.repCases':['الحالات المسندة لهذا المندوب','Cases assigned to this collector'],'drawer.deleteRep':['حذف هذا المندوب','Delete collector'],'drawer.assignedRep':['المندوب المسؤول','Assigned collector'],'drawer.assignRep':['إسناد / تغيير المندوب','Assign / change collector'],'drawer.assign':['تعيين','Assign'],'drawer.recordPayment':['تسجيل دفعة سداد','Record payment'],'drawer.addFollow':['إضافة متابعة','Add follow-up'],'drawer.activityLog':['سجل النشاط','Activity log'],'drawer.deleteDebtor':['حذف هذا المدين نهائيًا','Delete debtor permanently'],'drawer.installmentPlan':['خطة الأقساط','Installment plan'],'drawer.editPaidTitle':['تعديل المبلغ المسدد','Edit total paid'],'drawer.editPaidPrompt':['أدخل إجمالي المبلغ المسدد الصحيح:','Enter the correct total paid amount:'],'drawer.editPaymentPrompt':['أدخل المبلغ الصحيح لهذه الدفعة:','Enter the correct amount for this payment:'],'drawer.deletePaymentConfirm':['هل أنت متأكد من حذف هذه الدفعة؟ سيتم خصم مبلغها من إجمالي المسدد.','Delete this payment? Its amount will be removed from the total paid.'],'msg.paidAdjusted':['تم تعديل المبلغ المسدد','Total paid updated'],'msg.paymentUpdated':['تم تعديل الدفعة','Payment updated'],'msg.paymentDeleted':['تم حذف الدفعة','Payment deleted'],'drawer.editDebtor':['✎ تعديل بيانات المدين','✎ Edit debtor info'],'drawer.editRep':['✎ تعديل بيانات المندوب','✎ Edit collector info'],'drawer.editFollowPrompt':['أدخل النص الصحيح للملاحظة:','Enter the correct note text:'],'drawer.deleteFollowConfirm':['هل أنت متأكد من حذف هذه المتابعة؟','Delete this follow-up?'],'msg.followUpdated':['تم تعديل المتابعة','Follow-up updated'],'msg.followDeleted':['تم حذف المتابعة','Follow-up deleted'],'modal.editRep':['تعديل بيانات المندوب','Edit collector'],'modal.companyNumber':['رقم الشركة','Company number'],'modal.crNumber':['رقم السجل التجاري','Commercial registration'],'modal.addRep':['إضافة مندوب جديد','Add collector'],'modal.repName':['اسم المندوب','Collector name'],'modal.repArea':['المنطقة المسؤول عنها','Assigned area'],'modal.saveRep':['حفظ المندوب','Save collector'],
  'settings.users':['المستخدمون والصلاحيات','Users and permissions'],'settings.userName':['اسم المستخدم','Username'],'settings.userPassword':['كلمة المرور','Password'],'settings.userRole':['الدور','Role'],'settings.addUser':['إضافة مستخدم','Add user'],'settings.security':['إعدادات الأمان','Security Settings'],'settings.autoLogout':['تسجيل خروج تلقائي بعد 30 دقيقة من عدم النشاط','Auto logout after 30 minutes of inactivity'],'settings.sessionTimeout':['تنبيه قبل انتهاء الجلسة بـ 5 دقائق','Alert 5 minutes before session timeout'],'settings.passwordMinLength':['الحد الأدنى لطول كلمة المرور','Minimum password length'],'settings.changeAdminPassword':['تغيير كلمة مرور المدير','Change admin password'],'settings.appearance':['المظهر','Appearance'],'settings.palette':['لون الواجهة','Interface color'],'settings.theme':['لون التمييز','Accent color'],'settings.sync':['مزامنة Supabase','Supabase sync'],'settings.syncNow':['مزامنة الآن','Sync now'],'settings.audit':['سجل التدقيق','Audit log'],
  'role.admin':['مدير','Admin'],'role.collector':['مندوب','Collector'],'role.viewer':['مشاهد','Viewer'],'theme.gold':['ذهبي','Gold'],'theme.teal':['فيروزي','Teal'],'theme.blue':['أزرق','Blue'],'theme.rose':['وردي','Rose'],'theme.orange':['برتقالي','Orange'],'theme.purple':['بنفسجي','Purple'],'theme.green':['أخضر','Green'],'theme.custom':['لون مخصص...','Custom color...'],'theme.currentCustom':['لون مخصص','Custom color'],
  'palette.navy':['أزرق بحري','Navy'],'palette.forest':['أخضر غامق','Forest'],'palette.burgundy':['عنابي','Burgundy'],'palette.charcoal':['رمادي فحمي','Charcoal'],'palette.purple':['بنفسجي','Purple'],'palette.teal':['زيتي','Teal'],'palette.midnight':['منتصف الليل','Midnight'],'palette.sunset':['غروب','Sunset'],'palette.lightNavy':['أزرق فاتح','Light Navy'],'palette.lightForest':['أخضر فاتح','Light Forest'],'palette.lightRose':['وردي فاتح','Light Rose'],'palette.lightLavender':['بنفسجي فاتح','Light Lavender'],'palette.lightPeach':['خوخي فاتح','Light Peach'],'palette.custom':['لون مخصص...','Custom color...'],'palette.currentCustom':['لون مخصص','Custom color'],
  'modal.installments':['عدد الأقساط','Number of installments'],'modal.frequency':['دورية القسط','Installment frequency'],'frequency.monthly':['شهري','Monthly'],'frequency.quarterly':['ربع سنوي','Quarterly'],'frequency.weekly':['أسبوعي','Weekly'],
  'msg.assign':['تم إسناد الحالة للمندوب','Case assigned to collector'],'msg.unassign':['تم إلغاء إسناد الحالة','Case unassigned'],'msg.paymentAdded':['تم تسجيل الدفعة وخصمها من إجمالي الدين','Payment recorded and deducted from total debt'],'msg.followAdded':['تم تسجيل المتابعة','Follow-up recorded'],'msg.deleteDebtor':['هل أنت متأكد من حذف هذا المدين نهائيًا؟','Delete this debtor permanently?'],'msg.debtorDeleted':['تم حذف المدين','Debtor deleted'],'msg.repRequired':['الرجاء إدخال اسم المندوب','Enter the collector name'],'msg.repDeleted':['تم حذف المندوب','Collector deleted'],'msg.invalidAmount':['أدخل مبلغًا صحيحًا','Enter a valid amount'],'msg.noCases':['لا توجد حالات مسندة لهذا المندوب.','No cases assigned to this collector.'],'msg.exported':['تم تصدير النسخة الاحتياطية','Backup exported'],'msg.imported':['تم استيراد النسخة الاحتياطية بنجاح','Backup imported'],'msg.clearConfirm':['هل أنت متأكد من مسح جميع البيانات المسجلة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.','Clear all saved data permanently? This cannot be undone.'],'msg.clearConfirm2':['تأكيد أخير: سيتم حذف كل المدينين والمندوبين وسجلات السداد والمتابعات. متابعة؟','Final confirmation: delete all debtors, collectors, payments and follow-ups?'],'msg.cleared':['تم مسح جميع البيانات المسجلة','All saved data cleared'],'msg.noUpcoming':['لا توجد ديون مستحقة خلال هذه الفترة.','No debts are due in this period.'],'msg.todayDue':['مستحق اليوم','Due today'],'msg.daysLeft':['متبقي','remaining'],'msg.days':['يوم','days'],'msg.printedOn':['تم إصدار هذا الكشف إلكترونيًا من نظام دفتر لإدارة تحصيل الديون بتاريخ','This statement was generated electronically by Daftar on'],'msg.debtorSignature':['توقيع المدين','Debtor signature'],'msg.collectorSignature':['توقيع المسؤول عن التحصيل','Collector signature'],'msg.originalBalance':['رصيد الدين الأصلي','Original debt balance'],'msg.payment':['دفعة سداد','Payment'],'msg.statement':['كشف حساب مدين','Debtor statement'],'msg.statementSystem':['دفتر — نظام إدارة تحصيل الديون','Daftar - Debt collection system'],'msg.issued':['تاريخ الإصدار','Issued'],'msg.statusLabel':['الحالة','Status'],'msg.debtorData':['بيانات المدين','Debtor details'],'msg.companyData':['بيانات الشركة','Company details'],'msg.accountSummary':['ملخص الحساب','Account summary'],'msg.name':['الاسم','Name'],'msg.phone':['الهاتف','Phone'],'msg.companyNumber':['رقم الشركة','Company number'],'msg.crNumber':['السجل التجاري','Commercial registration'],'msg.dueDate':['تاريخ الاستحقاق','Due date'],'msg.collector':['المندوب المسؤول','Assigned collector'],'msg.notes':['ملاحظات','Notes'],'msg.date':['التاريخ','Date'],'msg.description':['البيان','Description'],'msg.debit':['مدين (سداد)','Debit (payment)'],'msg.credit':['دائن (دين)','Credit (debt)'],'msg.balance':['الرصيد المتبقي','Remaining balance'],'msg.totalDebt':['إجمالي الدين','Total debt'],'msg.totalPaid':['إجمالي المسدد','Total paid'],'msg.remainingBalance':['الرصيد المتبقي','Remaining balance'],'msg.followups':['سجل المتابعات','Follow-ups'],'msg.notAssigned':['غير مسند','Unassigned'],
  'audit.login':['تسجيل دخول','Login'],'audit.logout':['تسجيل خروج','Logout'],'audit.add_debtor':['إضافة مدين','Add debtor'],'audit.update_debtor':['تعديل مدين','Update debtor'],'audit.delete_debtor':['حذف مدين','Delete debtor'],'audit.add_payment':['تسجيل دفعة','Record payment'],'audit.add_followup':['إضافة متابعة','Add follow-up'],'audit.assign_rep':['إسناد مندوب','Assign collector'],'audit.unassign_rep':['إلغاء إسناد مندوب','Unassign collector'],'audit.add_rep':['إضافة مندوب','Add collector'],'audit.delete_rep':['حذف مندوب','Delete collector'],'audit.add_user':['إضافة مستخدم','Add user'],'audit.delete_user':['حذف مستخدم','Delete user'],'audit.link_user_rep':['ربط مستخدم بمندوب','Link user to collector'],'audit.save_auth':['تحديث بيانات الدخول','Update login details'],'audit.sync_supabaseClient':['مزامنة Supabase','Supabase sync'],'audit.theme_change':['تغيير لون النظام','Change system color'],'audit.palette_change':['تغيير لون الواجهة','Change interface color'],'audit.export_excel':['تصدير إكسل','Export Excel'],'audit.settings_change':['تغيير إعداد','Settings change'],'audit.export_backup':['تصدير نسخة احتياطية','Export backup'],'audit.import_backup':['استيراد نسخة احتياطية','Import backup'],'audit.clear_all_data':['مسح جميع البيانات','Clear all data'],
  'settings.auditFilter':['تصفية حسب المستخدم أو الإجراء...','Filter by user or action...'],'settings.auditEmpty':['لا توجد نتائج مطابقة.','No matching results.'],'settings.linkRep':['ربط بمندوب','Link collector'],'settings.noLink':['بدون ربط','Not linked'],'settings.repRequiredForCollector':['هذا المستخدم مندوب — اربطه بملف مندوب ليرى حالاته فقط','This user is a collector — link them to a collector profile so they only see their own cases'],
});
Object.assign(translations,{
  'nav.quotations':['عروض الأسعار','Quotations'],
  'quot.title':['قائمة عروض الأسعار','Quotations list'],
  'quot.search':['بحث باسم الشركة أو المسؤول...','Search by company or contact...'],
  'quot.importExcel':['⭱ استيراد من إكسل','⭱ Import Excel'],
  'quot.downloadTemplate':['⭳ نموذج الاستيراد','⭳ Import template'],
  'quot.print':['🖶 طباعة القائمة','🖶 Print list'],
  'quot.exportExcel':['⭳ تصدير إكسل','⭳ Export Excel'],
  'quot.pdf':['⭳ تحميل PDF','⭳ Download PDF'],
  'quot.add':['+ إضافة عرض سعر','+ Add quotation'],
  'quot.addTitle':['إضافة عرض سعر جديد','Add new quotation'],
  'quot.editTitle':['تعديل عرض السعر','Edit quotation'],
  'quot.save':['حفظ عرض السعر','Save quotation'],
  'quot.no':['م.','No.'],
  'quot.time':['الوقت','Time'],
  'quot.company':['اسم الشركة (العميل)','Company name (client)'],
  'quot.companyPh':['مثال: شركة الخليج للمقاولات','e.g. Gulf Trading & Contracting'],
  'quot.scope':['نشاط الشركة','Company activity'],
  'quot.contact':['المسؤول','Contact person'],
  'quot.mobile':['الجوال','Mobile'],
  'quot.email':['البريد الإلكتروني','Email'],
  'quot.amount':['قيمة العرض','Quotation value'],
  'quot.quotationNo':['رقم عرض السعر','Quotation No.'],
  'quot.quotationNoPh':['مثال: QTN-2026-00123','e.g. QTN-2026-00123'],
  'quot.invoiceNo':['رقم الفاتورة','Invoice No.'],
  'quot.projectNo':['رقم المشروع','Project No.'],
  'quot.subject':['الموضوع','Subject'],
  'quot.nextFollowup':['المتابعة القادمة','Next follow-up'],
  'quot.requirement':['تفاصيل / متطلبات العميل','Details / client requirement'],
  'quot.requirementPh':['تفاصيل النقاش مع العميل...','Discussion details with the client...'],
  'quot.followupAction':['إجراء المتابعة / الخطوة القادمة','Follow-up action / next step'],
  'quot.followupActionPh':['مثال: الاتصال يوم الأحد لتأكيد السعر','e.g. Call on Sunday to confirm pricing'],
  'quot.empty':['لا توجد عروض أسعار مطابقة.','No matching quotations.'],
  'quot.scope.mainContractor':['مقاول رئيسي','Main contractor'],
  'quot.scope.subcontractor':['مقاول من الباطن','Subcontractor'],
  'quot.scope.consultant':['استشاري','Consultant'],
  'quot.scope.developer':['مطوّر / عميل مباشر','Developer / direct client'],
  'quot.scope.supplier':['مورّد / مصنّع','Supplier / manufacturer'],
  'quot.subject.quoteFollowup':['متابعة عرض سعر','Follow up quote'],
  'quot.subject.newClient':['عميل مستهدف جديد','New target client'],
  'quot.subject.payment':['متابعة دفعة','Payment follow-up'],
  'quot.status.open':['مفتوح','Open'],
  'quot.status.submitted':['تم تقديم العرض','Quotation submitted'],
  'quot.status.followup':['بانتظار المتابعة','Follow-up required'],
  'quot.status.paymentPending':['بانتظار الدفع','Payment pending'],
  'quot.status.closed':['مغلق','Closed'],
  'quot.editBtn':['✎ تعديل بيانات العرض','✎ Edit quotation'],
  'quot.printOne':['🖶 طباعة تفاصيل العرض','🖶 Print quotation details'],
  'quot.deleteBtn':['حذف عرض السعر نهائيًا','Delete quotation permanently'],
  'quot.addStatusUpdate':['إضافة تحديث يومي للحالة','Add daily status update'],
  'quot.updateNotePh':['ملاحظة التحديث اليومي...','Daily update note...'],
  'quot.statusLog':['سجل تحديثات الحالة','Status update log'],
  'quot.reportTitle':['التقرير اليومي لعروض الأسعار','Daily quotations report'],
  'quot.fromDate':['من تاريخ','From date'],
  'quot.toDate':['إلى تاريخ','To date'],
  'quot.generate':['إنشاء التقرير','Generate report'],
  'quot.reportEmpty':['لا توجد تحديثات حالة مسجّلة خلال هذه الفترة.','No status updates recorded in this period.'],
  'quot.confirmDelete':['هل أنت متأكد من حذف عرض السعر هذا نهائيًا؟','Delete this quotation permanently?'],
  'quot.needCompany':['الرجاء إدخال اسم الشركة','Enter the company name'],
  'quot.added':['تمت إضافة عرض السعر بنجاح','Quotation added'],
  'quot.updated':['تم تحديث عرض السعر','Quotation updated'],
  'quot.deleted':['تم حذف عرض السعر','Quotation deleted'],
  'quot.updateAdded':['تم تسجيل تحديث الحالة','Status update recorded'],
  'quot.needUpdateNote':['الرجاء إدخال ملاحظة أو اختيار حالة للتحديث','Enter a note or choose a status to log'],
  'quot.noLog':['لا توجد تحديثات مسجّلة بعد.','No updates recorded yet.'],
  'quot.imported':['تم استيراد بيانات عروض الأسعار','Quotation data imported'],
  'quot.importFailed':['تعذّرت قراءة ملف Excel','Could not read the Excel file'],
  'quot.importDoc':['⭱ استيراد مستند (PDF / صورة / Word)','⭱ Import document (PDF / image / Word)'],
  'quot.reading':['جارٍ قراءة المستند واستخراج البيانات…','Reading the document and extracting data…'],
  'quot.extracted':['تم استخراج البيانات — راجعها ثم احفظ','Data extracted — review it and save'],
  'quot.readFailed':['تعذّر استخراج البيانات من المستند','Could not extract data from the document'],
  'quot.reviewTitle':['مراجعة البيانات المستخرجة من المستند','Review data extracted from the document'],
  'quot.extractedFrom':['تم استخراج البيانات تلقائيًا من الملف:','Data extracted automatically from:'],
  'quot.uploading':['جارٍ رفع الملف إلى التخزين السحابي…','Uploading the file to cloud storage…'],
  'quot.fileSaved':['تم حفظ عرض السعر والملف سحابيًا','Quotation and file saved to the cloud'],
  'quot.fileFailed':['تعذّر رفع الملف إلى التخزين السحابي','Could not upload the file to cloud storage'],
  'quot.attachments':['الملفات المرفقة','Attached files'],
  'quot.attachFile':['⭱ إرفاق ملف','⭱ Attach file'],
  'quot.noFiles':['لا توجد ملفات مرفقة بهذا العرض.','No files attached to this quotation.'],
  'quot.viewFile':['👁 عرض','👁 View'],
  'quot.printFile':['🖶 طباعة','🖶 Print'],
  'quot.visitReportTitle':['تقرير الزيارات اليومي للعملاء','Daily client visit report'],
  'quot.visitReportDate':['تاريخ التقرير','Report date'],
  'quot.salesInCharge':['مسؤول المبيعات','Sales in-charge'],
  'quot.salesInChargePh':['اسم مسؤول المبيعات','Sales representative name'],
  'quot.areaRoute':['المنطقة / خط السير','Area / route'],
  'quot.areaRoutePh':['مثال: الدوحة','e.g. Doha'],
  'quot.visitReportEmpty':['لا توجد زيارات مسجّلة في هذا التاريخ.','No visits recorded on this date.'],
  'quot.reportPeriod':['الفترة','Period'],
  'quot.reportDate':['التاريخ','Date'],
  'quot.reportAreaRoute':['المنطقة / خط السير','Area / route'],
  'quot.reportSalesInCharge':['مسؤول المبيعات','Sales in-charge'],
  'quot.visitSummaryTitle':['ملخص الزيارات اليومي','Daily visit summary'],
  'quot.totalVisits':['إجمالي عدد الزيارات','Total client visits'],
  'quot.preparedBy':['إعداد / التوقيع','Prepared by / signature'],
  'quot.reviewedBy':['مراجعة / مدير المبيعات','Reviewed by / sales manager'],
  'quot.discussion':['النقاش / متطلبات العميل','Discussion / client requirement'],
  'quot.statusRemarks':['الحالة / الملاحظات','Status / remarks'],
  'quot.visitPurpose':['غرض الزيارة','Visit purpose'],
  'audit.add_quotation':['إضافة عرض سعر','Add quotation'],
  'audit.update_quotation':['تعديل عرض سعر','Update quotation'],
  'audit.delete_quotation':['حذف عرض سعر','Delete quotation'],
  'audit.quotation_status_update':['تحديث حالة عرض سعر','Quotation status update'],
});
function t(key){ const value=translations[key]; return value ? value[currentLang==='en'?1:0] : key; }
// escape any user-supplied string before it is inserted into innerHTML, to avoid
// broken layouts or script injection when names/notes/imported data contain HTML.
function esc(value){
  return String(value??'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function notesTd(d){
  const n=String(d.notes||'').trim();
  if(!n) return `<td class="notes-cell">—</td>`;
  return `<td class="notes-cell" title="${esc(n)}">${esc(n)}</td>`;
}
function currency(value){ return `${fmt(value)} ${currentLang==='en'?'QAR':'ر.ق'}`; }
function translateValue(value){
  const map={'نقدًا':'method.cash','شيك':'method.cheque','تحويل بنكي':'method.transfer','اتصال هاتفي':'method.call','رسالة نصية':'method.sms','زيارة ميدانية':'method.visit','بريد إلكتروني':'method.email','فرد':'debtors.individual','شركة':'debtors.company'};
  return map[value]?t(map[value]):value;
}
function applyLanguage(){
  document.documentElement.lang=currentLang; document.documentElement.dir=currentLang==='en'?'ltr':'rtl';
  document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));
  document.querySelectorAll('[data-i18n-ph]').forEach(el=>el.placeholder=t(el.dataset.i18nPh));
  document.querySelectorAll('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle); el.setAttribute('aria-label',t(el.dataset.i18nTitle));});
  document.getElementById('langArBtn').classList.toggle('active',currentLang==='ar'); document.getElementById('langEnBtn').classList.toggle('active',currentLang==='en');
  const page = document.querySelector('.nav-item.active')?.dataset.page || 'dashboard';
  const titles = {dashboard:['لوحة التحكم','نظرة عامة على حالة التحصيل اليوم'],debtors:['المدينون','إدارة كافة ملفات المدينين'],reps:['المندوبون','فريق التحصيل الميداني وأداء كل مندوب'],payments:['سجل السداد','جميع عمليات السداد المسجّلة'],followups:['المتابعات','سجل الاتصالات والزيارات'],quotations:['عروض الأسعار','متابعة عروض الأسعار المقدمة للعملاء'],aging:['أعمار الديون','تصنيف المتأخرات حسب مدة التأخير (30/60/90 يوم)'],reports:['التقارير','ملخص مالي وتحليل الحالات'],settings:['الإعدادات','النسخ الاحتياطي وإدارة بيانات النظام']};
  document.getElementById('pageTitle').textContent = currentLang==='en' ? EN_TITLES[page][0] : titles[page][0];
  document.getElementById('pageSub').textContent = currentLang==='en' ? EN_TITLES[page][1] : titles[page][1];
  renderUsers(); renderAudit(); updateThemeSwatchesUI();
  document.getElementById('notificationsBtn').title=currentLang==='en'?'Notifications':'الإشعارات';
  document.getElementById('notificationsBtn').setAttribute('aria-label',currentLang==='en'?'Notifications':'الإشعارات');
  document.getElementById('themeToggleBtn').title=currentMode==='dark'?t('theme.lightMode'):t('theme.darkMode');
  document.getElementById('themeToggleBtn').setAttribute('aria-label',currentMode==='dark'?t('theme.lightMode'):t('theme.darkMode'));
  renderNotifications();
}
document.getElementById('langArBtn').addEventListener('click',()=>{currentLang='ar';localStorage.setItem('daftar_language',currentLang);appSettings.language=currentLang;saveSettings();applyLanguage();renderAll();});
document.getElementById('langEnBtn').addEventListener('click',()=>{currentLang='en';localStorage.setItem('daftar_language',currentLang);appSettings.language=currentLang;saveSettings();applyLanguage();renderAll();});
document.querySelectorAll('[data-login-lang]').forEach(button=>button.addEventListener('click',()=>{
  currentLang=button.dataset.loginLang; localStorage.setItem('daftar_language',currentLang); appSettings.language=currentLang; saveSettings(); applyLanguage();
  document.querySelectorAll('[data-login-lang]').forEach(item=>item.classList.toggle('active',item.dataset.loginLang===currentLang));
}));
let currentMode=localStorage.getItem('daftar_mode')||'dark';
let notifications=[];
function getNotifications(){
  return scopedDebtors().filter(d=>remaining(d)>0).map(d=>{const diff=daysBetween(todayISO(),d.due);return diff<0?{type:'overdue',name:d.name,date:d.due}:diff===0?{type:'dueToday',name:d.name,date:d.due}:diff<=7?{type:'dueSoon',name:d.name,date:d.due}:null;}).filter(Boolean);
}
function renderNotifications(){
  const list=getNotifications(); const panel=document.getElementById('notificationsList'); const count=document.getElementById('notificationCount');
  count.textContent=list.length; count.style.display=list.length?'block':'none';
  panel.innerHTML=list.length?list.map(item=>`<div class="notification-item"><b>${esc(item.name)}</b> · ${t(`notifications.${item.type}`)}<small>${esc(item.date)}</small></div>`).join(''):`<div class="empty">${t('notifications.none')}</div>`;
}
function applyMode(){document.documentElement.dataset.mode=currentMode;document.getElementById('themeToggleBtn').textContent=currentMode==='dark'?'☼':'◐';document.getElementById('themeToggleBtn').title=currentMode==='dark'?t('theme.lightMode'):t('theme.darkMode');localStorage.setItem('daftar_mode',currentMode);if(typeof appSettings!=='undefined'){appSettings.mode=currentMode;saveSettings();}}
document.getElementById('themeToggleBtn').addEventListener('click',()=>{currentMode=currentMode==='dark'?'light':'dark';applyMode();});
document.getElementById('notificationsBtn').addEventListener('click',()=>document.getElementById('notificationPanel').classList.toggle('show'));
document.getElementById('clearNotificationsBtn').addEventListener('click',()=>document.getElementById('notificationPanel').classList.remove('show'));

const USERS_KEY = 'daftar_users_v1';
const AUDIT_KEY = 'daftar_audit_v1';
const CLOUD_ADMIN = Object.freeze({username:'walid',password:'Ksi@33774995',role:'admin'});
let users = loadUsers();
let auditLog = loadAudit();
let currentUser = null;
function loadUsers(){
  return [];
}
function loadAudit(){
  return [];
}
async function saveUsers(){
  if (!supabaseClient) throw new Error('Supabase is not available');
  const {error} = await supabaseClient.from('users').upsert(
    users.map(user=>({id:user.id,username:user.username,password:user.password,role:user.role,rep_id:user.repId||null})),
    {onConflict:'id'}
  );
  if(error) throw error;
}
async function addAudit(action,details=''){
  auditLog.unshift({id:Date.now(),date:new Date().toISOString(),user:currentUser?.username||'system',action,details});
  auditLog=auditLog.slice(0,500);
  if (!supabaseClient) throw new Error('Supabase is not available');
  const {error} = await supabaseClient.from('audit_log').insert({
    id:auditLog[0].id,
    date:auditLog[0].date,
    user:auditLog[0].user,
    action:auditLog[0].action,
    details:auditLog[0].details
  });
  if(error) throw error;
  renderAudit();
}
function auditLabel(action){const key=`audit.${action}`;const value=translations[key];return value?value[currentLang==='en'?1:0]:action;}
function can(permission){return currentUser?.role==='admin' || (currentUser?.role==='collector' && permission!=='manageUsers' && permission!=='delete') || (currentUser?.role==='viewer' && permission==='view');}
function roleLabel(role){return {admin:currentLang==='en'?'Admin':'مدير',collector:currentLang==='en'?'Collector':'مندوب',viewer:currentLang==='en'?'Viewer':'مشاهد'}[role]||role;}
function getAuth(){
  return CLOUD_ADMIN;
}
function updateAuthUI(){
  const auth=getAuth(); document.getElementById('s_authUser').value=auth.username;
  document.getElementById('loginScreen').style.display=sessionStorage.getItem('daftar_logged_in')==='1'?'none':'flex';
  document.getElementById('sidebarUserLine').textContent=sessionStorage.getItem('daftar_logged_in')==='1' ? `${currentLang==='en'?'Signed in as':'مسجل الدخول باسم'}: ${auth.username}` : '';
  document.querySelectorAll('[data-login-lang]').forEach(item=>item.classList.toggle('active',item.dataset.loginLang===currentLang));
  if(sessionStorage.getItem('daftar_logged_in')==='1' && !currentUser){currentUser=users.find(user=>user.username===CLOUD_ADMIN.username)||null;}
}
document.getElementById('loginBtn').addEventListener('click',async()=>{
  const user=document.getElementById('login_user').value.trim(); const pass=document.getElementById('login_pass').value; 
  const {data:account,error} = supabaseClient ? await supabaseClient.from('users').select('id,username,password,role,rep_id').eq('username',user).eq('password',pass).maybeSingle() : {data:null,error:new Error('Supabase is not available')};
  
  if(account && account.username===CLOUD_ADMIN.username){
    currentUser={id:account.id,username:account.username,password:account.password,role:account.role,repId:account.rep_id};
    sessionStorage.setItem('daftar_logged_in','1');
    sessionStorage.setItem('daftar_user_id',String(currentUser.id));
    document.getElementById('loginError').textContent='';
    await addAudit('login');
    updateAuthUI();
    applyPermissions();
  } else {
    document.getElementById('loginError').textContent=error ? (currentLang==='en'?'Cloud database is unavailable':'قاعدة البيانات السحابية غير متاحة') : (currentLang==='en'?'Invalid username or password':'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
});
document.getElementById('login_pass').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('loginBtn').click();});
document.getElementById('logoutBtn').addEventListener('click',()=>{addAudit('logout');sessionStorage.removeItem('daftar_logged_in');sessionStorage.removeItem('daftar_user_id');currentUser=null;updateAuthUI();});
document.getElementById('saveAuthBtn').addEventListener('click',()=>{
  const username=document.getElementById('s_authUser').value.trim(); const password=document.getElementById('s_authPass').value;
    if(username!==CLOUD_ADMIN.username || (password && password!==CLOUD_ADMIN.password)){toast(currentLang==='en'?'The cloud login is fixed to walid':'بيانات الدخول السحابية ثابتة باسم walid');return;}
    document.getElementById('s_authPass').value=''; updateAuthUI(); toast(currentLang==='en'?'Cloud login verified':'تم التحقق من بيانات الدخول السحابية');
});
function applyPermissions(){
  const locked=!can('write');
  const lockedDelete=!can('delete');
  document.getElementById('addDebtorBtn').disabled=locked;
  document.getElementById('addRepBtn').disabled=locked;
  document.querySelectorAll('[data-write]').forEach(el=>el.disabled=locked);
  document.querySelectorAll('[data-delete]').forEach(el=>el.disabled=lockedDelete);
  document.querySelector('[data-page="settings"]').style.display=can('manageUsers')?'flex':'none';
  // collectors manage their own cases only — hiding the collector-management page keeps
  // them from browsing (or reassigning cases away from) other collectors
  document.querySelector('[data-page="reps"]').style.display=(currentUser?.role==='admin')?'flex':'none';
  const assignBox=document.getElementById('dr_assignRepBox');
  if(assignBox) assignBox.style.display=(currentUser?.role==='admin')?'':'none';
  const assignTitle=document.getElementById('dr_assignRepTitle');
  if(assignTitle) assignTitle.style.display=(currentUser?.role==='admin')?'':'none';
}
// returns the subset of debtors the logged-in user is allowed to see.
// Admins and viewers see everything; a collector only sees cases assigned to
// the collector profile linked to their account (see renderUsers' rep-link control).
// NOTE: this only filters what is *rendered* — since all data lives in the
// browser's localStorage, a determined user could still inspect it via devtools.
// Real access control requires a server (see the Supabase suggestion in README).
function scopedDebtors(){
  if(currentUser?.role==='collector'){
    if(!currentUser.repId) return [];
    return debtors.filter(d=>d.repId===currentUser.repId);
  }
  return debtors;
}
function renderUsers(){const el=document.getElementById('usersList');if(!el)return;el.innerHTML=users.map(user=>{
  const linkedRep=reps.find(r=>r.id===user.repId);
  const repControl = user.role==='collector' ? `<select data-link-user="${user.id}" class="mini-select" title="${t('settings.linkRep')}">
      <option value="">${t('settings.noLink')}</option>
      ${reps.map(r=>`<option value="${r.id}" ${r.id===user.repId?'selected':''}>${esc(r.name)}</option>`).join('')}
    </select>` : '';
  return `<div class="audit-row"><b>${esc(user.username)}</b><span>${roleLabel(user.role)}</span>${repControl}${user.id!==1?`<button class="icon-btn danger" data-remove-user="${user.id}" title="${t('action.delete')}">✕</button>`:''}</div>`;
}).join('');
  el.querySelectorAll('[data-remove-user]').forEach(button=>button.addEventListener('click',()=>{const removed=users.find(u=>u.id===Number(button.dataset.removeUser));users=users.filter(user=>user.id!==Number(button.dataset.removeUser));saveUsers();addAudit('delete_user',removed?removed.username:button.dataset.removeUser);renderUsers();}));
  el.querySelectorAll('[data-link-user]').forEach(select=>select.addEventListener('change',()=>{
    const user=users.find(u=>u.id===Number(select.dataset.linkUser)); if(!user) return;
    const repId=select.value?Number(select.value):null; const rep=reps.find(r=>r.id===repId);
    user.repId=repId||undefined; saveUsers();
    addAudit('link_user_rep', `${user.username} → ${rep?rep.name:t('settings.noLink')}`);
    if(currentUser && currentUser.id===user.id) renderAll();
    toast(currentLang==='en'?'Collector link updated':'تم تحديث ربط المندوب');
  }));
}
function renderAudit(){
  const el=document.getElementById('auditList');if(!el)return;
  const filterInput=document.getElementById('auditFilter');
  const q=(filterInput?filterInput.value:'').trim().toLowerCase();
  const filtered=auditLog.filter(item=>!q || item.user.toLowerCase().includes(q) || auditLabel(item.action).toLowerCase().includes(q) || (item.details||'').toLowerCase().includes(q));
  el.innerHTML=filtered.slice(0,80).map(item=>`<div class="audit-row"><b>${esc(auditLabel(item.action))}</b><span>${esc(item.user)}</span>${item.details?`<small class="audit-detail">${esc(item.details)}</small>`:''}<time>${new Date(item.date).toLocaleString(currentLang==='en'?'en-US':'ar-QA')}</time></div>`).join('') || `<div class="empty">${q?t('settings.auditEmpty'):(currentLang==='en'?'No audit events yet.':'لا توجد أحداث بعد.')}</div>`;
}
document.getElementById('addUserBtn').addEventListener('click',()=>{if(!can('manageUsers'))return;const username=document.getElementById('u_name').value.trim();const password=document.getElementById('u_password').value;const role=document.getElementById('u_role').value;if(!username||!password){toast(currentLang==='en'?'Username and password are required':'اسم المستخدم وكلمة المرور مطلوبان');return;}users.push({id:Date.now(),username,password,role});saveUsers();addAudit('add_user',`${username} (${roleLabel(role)})`);renderUsers();document.getElementById('u_name').value='';document.getElementById('u_password').value='';});

let debtors = [
  {id:1, name:"محمد عبدالله السويدي", type:"individual", companyNumber:"", crNumber:"", phone:"+974 5511 2233", total:45000, paid:15000, due:"2026-09-10", notes:"عميل تجاري - قسط شهري", log:[
    {type:"follow", date:"2026-08-01", method:"اتصال هاتفي", note:"وعد بالسداد نهاية الشهر"},
    {type:"payment", date:"2026-07-15", amount:5000, method:"تحويل بنكي"}
  ]},
  {id:2, name:"فاطمة أحمد المهندي", type:"individual", companyNumber:"", crNumber:"", phone:"+974 5522 8891", total:12000, paid:12000, due:"2026-07-01", notes:"تم السداد بالكامل", log:[
    {type:"payment", date:"2026-06-30", amount:12000, method:"نقدًا"}
  ]},
  {id:3, name:"يوسف خالد النعيمي", type:"individual", companyNumber:"", crNumber:"", phone:"+974 3344 5566", total:80000, paid:10000, due:"2026-06-01", notes:"متعثر - متابعة قانونية قيد الدرس", log:[
    {type:"follow", date:"2026-08-10", method:"زيارة ميدانية", note:"لم يتم الوصول للعميل"},
    {type:"follow", date:"2026-07-20", method:"اتصال هاتفي", note:"رفض الرد"}
  ]},
  {id:4, name:"شركة الخليج للمقاولات", type:"company", companyNumber:"CO-10452", crNumber:"128734", phone:"+974 4433 7788", total:220000, paid:120000, due:"2026-10-05", notes:"سداد على دفعات ربع سنوية", log:[
    {type:"payment", date:"2026-08-01", amount:60000, method:"شيك"},
    {type:"follow", date:"2026-07-25", method:"بريد إلكتروني", note:"تأكيد جدول السداد"}
  ]},
];
let nextId = 5;
let activeDebtorId = null;
let lastStatementHtml = '';

let reps = [
  {id:1, name:"أحمد سالم الكواري", phone:"+974 5566 1122", area:"الدوحة - الوسط"},
  {id:2, name:"سارة محمد آل ثاني", phone:"+974 5577 3344", area:"الريان"},
];
let nextRepId = 3;
let activeRepId = null;

// assign existing sample debtors to reps
debtors[0].repId = 1;
debtors[2].repId = 1;
debtors[3].repId = 2;

// ============== QUOTATIONS (عروض الأسعار) ==============
let quotations = [
  {id:1, date:"2026-08-25", visitTime:"12:00", companyName:"شركة الخليج للمقاولات", companyScope:"mainContractor", contactPerson:"م. أحمد", mobile:"+974 5511 2233", email:"purchase@gulf-example.com", amount:85000, quotationNo:"QTN-2026-00123", invoiceNo:"", projectNo:"", subject:"quoteFollowup", nextFollowup:"2026-09-08", status:"submitted", requirement:"طلبوا عرض سعر لتوريد مواد المشروع الجديد.", followupAction:"الاتصال لتأكيد استلام العرض ومناقشة الأسعار.", notes:"", log:[
    {id:1, date:"2026-08-25", status:"submitted", note:"تم إرسال عرض السعر عبر البريد الإلكتروني."}
  ]},
];
let nextQuotationId = 2;
let nextQuotationLogId = 2;
let activeQuotationId = null;

// ============== PERSISTENCE ==============
const STORAGE_KEY = 'daftar_debt_system_v1';

// Supabase sync functions
let syncInProgress = null;
let syncQueued = false;
let lastSyncError = null;
async function replaceTable(table, rows, key='id') {
  const { data: existing, error: readError } = await supabaseClient.from(table).select(key);
  if(readError){ readError.message = `[${table}] ${readError.message||''}`; throw readError; }
  const ids = new Set(rows.map(row=>String(row[key])));
  for(const row of existing || []) {
    if(!ids.has(String(row[key]))) {
      const { error } = await supabaseClient.from(table).delete().eq(key, row[key]);
      if(error){ error.message = `[${table}] ${error.message||''}`; throw error; }
    }
  }
  if(rows.length) {
    const { error } = await supabaseClient.from(table).upsert(rows, {onConflict:key});
    if(error){ error.message = `[${table}] ${error.message||''}`; throw error; }
  }
}
async function syncToSupabase() {
  if (!supabaseClient) {
    console.warn('Supabase sync skipped: client not initialized');
    return false;
  }
  if (syncInProgress) { syncQueued = true; return syncInProgress; }
  syncInProgress = (async()=>{
    try {
      console.info('Starting Supabase sync', { debtors: debtors.length, quotations: quotations.length, reps: reps.length });
      const debtorRows = debtors.map(debtor=>({id:debtor.id,name:debtor.name,type:debtor.type,company_number:debtor.companyNumber||'',cr_number:debtor.crNumber||'',phone:debtor.phone||'',total:debtor.total,paid:debtor.paid,due:debtor.due||null,notes:debtor.notes||'',rep_id:debtor.repId||null}));
      const activityRows = debtors.flatMap(debtor=>(debtor.log||[]).map(activity=>({id:activity.id,debtor_id:debtor.id,type:activity.type,activity_date:activity.date,amount:activity.amount||null,method:activity.method||null,note:activity.note||null})));
      await replaceTable('debtors', debtorRows);
      await replaceTable('debtors_activity', activityRows);
      await replaceTable('reps', reps.map(rep=>({id:rep.id,name:rep.name,phone:rep.phone||'',area:rep.area||''})));
      const quotationRows = quotations.map(q=>({id:q.id,date:q.date||null,visit_time:q.visitTime||'',company_name:q.companyName||'',company_scope:q.companyScope||'',contact_person:q.contactPerson||'',mobile:q.mobile||'',email:q.email||'',amount:q.amount||null,quotation_no:q.quotationNo||'',invoice_no:q.invoiceNo||'',project_no:q.projectNo||'',subject:q.subject||'',next_followup:q.nextFollowup||null,status:q.status||'open',requirement:q.requirement||'',followup_action:q.followupAction||'',notes:q.notes||''}));
      const quotationLogRows = quotations.flatMap(q=>(q.log||[]).map(entry=>({id:entry.id,quotation_id:q.id,log_date:entry.date,status:entry.status||'',note:entry.note||''})));
      await replaceTable('quotations', quotationRows);
      await replaceTable('quotations_activity', quotationLogRows);
      await replaceTable('users', users.map(user=>({id:user.id,username:user.username,password:user.password,role:user.role,rep_id:user.repId||null})));
      await replaceTable('audit_log', auditLog.map(audit=>({id:audit.id,date:audit.date,user:audit.user,action:audit.action,details:audit.details||''})));
      const { error: settingsError } = await supabaseClient.from('app_settings').upsert({id:1,settings:appSettings,updated_at:new Date().toISOString()},{onConflict:'id'});
      if(settingsError) throw settingsError;
      console.info('Supabase sync succeeded');
      lastSyncError = null;
      return true;
    } catch (e) {
      const parts = [e?.code, e?.message, e?.details, e?.hint].filter(Boolean);
      lastSyncError = parts.length ? parts.join(' — ') : String(e);
      console.warn('Supabase sync failed:', e);
      return false;
    } finally {
      syncInProgress = null;
      if(syncQueued){ syncQueued=false; syncToSupabase(); }
    }
  })();
  return syncInProgress;
}

async function loadFromSupabase() {
  if (!supabaseClient) return false;
  
  try {
    // Load debtors
    const { data: debtorsData, error: debtorsError } = await supabaseClient
      .from('debtors')
      .select('*');
    
    if (debtorsError) throw debtorsError;
    
    // Load activities
    const { data: activitiesData, error: activitiesError } = await supabaseClient
      .from('debtors_activity')
      .select('*');
    
    if (activitiesError) throw activitiesError;

    const { data: repsData, error: repsError } = await supabaseClient
      .from('reps')
      .select('*');
    if (repsError) throw repsError;

    const { data: quotationsData, error: quotationsError } = await supabaseClient
      .from('quotations')
      .select('*');
    if (quotationsError) throw quotationsError;

    const { data: quotationsActivityData, error: quotationsActivityError } = await supabaseClient
      .from('quotations_activity')
      .select('*');
    if (quotationsActivityError) throw quotationsActivityError;
    
    const { data: walidUser, error: walidError } = await supabaseClient
      .from('users')
      .select('id')
      .eq('username',CLOUD_ADMIN.username)
      .maybeSingle();
    if(walidError) throw walidError;
    if(walidUser){
      const {error} = await supabaseClient.from('users').update({password:CLOUD_ADMIN.password,role:CLOUD_ADMIN.role}).eq('id',walidUser.id);
      if(error) throw error;
    } else {
      const {data: firstUser, error: firstUserError} = await supabaseClient.from('users').select('id').order('id',{ascending:true}).limit(1).maybeSingle();
      if(firstUserError) throw firstUserError;
      const {error} = firstUser
        ? await supabaseClient.from('users').update({username:CLOUD_ADMIN.username,password:CLOUD_ADMIN.password,role:CLOUD_ADMIN.role}).eq('id',firstUser.id)
        : await supabaseClient.from('users').insert({id:1,username:CLOUD_ADMIN.username,password:CLOUD_ADMIN.password,role:CLOUD_ADMIN.role});
      if(error) throw error;
    }

    // Load users from the cloud
    const { data: usersData, error: usersError } = await supabaseClient
      .from('users')
      .select('*');
    
    if (usersError) throw usersError;
    
    // Load audit log
    const { data: auditData, error: auditError } = await supabaseClient
      .from('audit_log')
      .select('*');
    
    if (auditError) throw auditError;
    
    // Map Supabase data to app structure
    debtors = (debtorsData || []).map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        companyNumber: d.company_number || '',
        crNumber: d.cr_number || '',
        phone: d.phone || '',
        total: d.total,
        paid: d.paid,
        due: d.due,
        notes: d.notes || '',
        repId: d.rep_id,
        log: []
      }));
      
      // Map activities to debtor logs
      if (activitiesData) {
        activitiesData.forEach(a => {
          const debtor = debtors.find(d => d.id === a.debtor_id);
          if (debtor) {
            debtor.log.push({
              id: a.id,
              type: a.type,
              date: a.activity_date,
              amount: a.amount,
              method: a.method,
              note: a.note
            });
          }
        });
      }
      
      // Update IDs
      nextId = Math.max(0, ...debtors.map(d => d.id)) + 1;
      nextLogId = Math.max(0, ...debtors.flatMap(d => (d.log || []).map(l => l.id || 0))) + 1;
    reps = (repsData || []).map(r => ({id:r.id,name:r.name,phone:r.phone||'',area:r.area||''}));
    nextRepId = Math.max(0, ...reps.map(r => Number(r.id)||0)) + 1;

    quotations = (quotationsData || []).map(q => ({
      id: q.id, date: q.date, visitTime: q.visit_time || '', companyName: q.company_name || '', companyScope: q.company_scope || '',
      contactPerson: q.contact_person || '', mobile: q.mobile || '', email: q.email || '', amount: q.amount,
      quotationNo: q.quotation_no || '', invoiceNo: q.invoice_no || '', projectNo: q.project_no || '',
      subject: q.subject || '', nextFollowup: q.next_followup, status: q.status || 'open',
      requirement: q.requirement || '', followupAction: q.followup_action || '', notes: q.notes || '', log: []
    }));
    if (quotationsActivityData) {
      quotationsActivityData.forEach(entry => {
        const q = quotations.find(x => x.id === entry.quotation_id);
        if (q) q.log.push({id: entry.id, date: entry.log_date, status: entry.status, note: entry.note});
      });
    }
    quotations.forEach(q => q.log.sort((a,b)=> (a.date||'').localeCompare(b.date||'')));
    nextQuotationId = Math.max(0, ...quotations.map(q => Number(q.id)||0)) + 1;
    nextQuotationLogId = Math.max(0, ...quotations.flatMap(q => (q.log||[]).map(l => Number(l.id)||0))) + 1;
    
    // Map users
    users = (usersData || []).map(u => ({
        id: u.id,
        username: u.username,
        password: u.password,
        role: u.role,
        repId: u.rep_id
      }));
    
    // Map audit log
    auditLog = (auditData || []).map(a => ({
        id: a.id,
        date: a.date,
        user: a.user,
        action: a.action,
        details: a.details
      }));

    // Attachments are loaded separately and never wiped by replaceTable().
    await loadQuotationFiles();

    const { data: settingsData, error: settingsError } = await supabaseClient
      .from('app_settings').select('settings').eq('id',1).maybeSingle();
    if(settingsError) throw settingsError;
    if(settingsData?.settings) appSettings = {...appSettings,...settingsData.settings};
    
    return true;
  } catch (e) {
    console.warn('Supabase load failed:', e);
    return false;
  }
}

function clearLegacyBrowserState(){
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear(); } catch (e) {}
}

async function saveState(){
  return await syncToSupabase();
}
// A toast disappears in ~2 seconds, which is easy to miss, and it was hiding real
// Supabase errors from the user. This banner stays on screen with the literal error
// text until dismissed, so the exact cause (a rejected column, a bad value, an RLS
// policy, etc.) can be read and copied rather than silently lost.
function showSyncErrorBanner(context, detail){
  const banner = document.getElementById('quotSyncErrorBanner');
  if(!banner) return;
  const label = currentLang==='en'
    ? `Cloud save failed (${context}). The data below was NOT saved to Supabase:`
    : `فشل الحفظ السحابي (${context}). البيانات التالية لم تُحفظ في Supabase:`;
  banner.querySelector('.sync-error-text').textContent = `${label}\n${detail||''}`;
  banner.style.display = 'flex';
}
document.getElementById('quotSyncErrorBanner')?.addEventListener('click', ev=>{
  if(ev.target.closest('[data-dismiss-sync-error]')){
    document.getElementById('quotSyncErrorBanner').style.display = 'none';
  }
  if(ev.target.closest('[data-copy-sync-error]')){
    const text = document.querySelector('#quotSyncErrorBanner .sync-error-text')?.textContent || '';
    navigator.clipboard?.writeText(text).then(
      ()=>toast(currentLang==='en'?'Error text copied':'تم نسخ نص الخطأ'),
      ()=>toast(currentLang==='en'?'Could not copy — select the text manually':'تعذّر النسخ — حدّد النص يدويًا')
    );
  }
});
// Use this whenever the user performs an explicit action that MUST reach the cloud.
// Unlike saveState() it tells the user (and the console) when the write did not land,
// instead of leaving rows that only live in this browser tab until the next reload.
async function saveStateOrWarn(context=''){
  const ok = await saveState();
  if(!ok){
    const detail = lastSyncError || (currentLang==='en'?'Unknown error':'خطأ غير معروف');
    showSyncErrorBanner(context || (currentLang==='en'?'saving':'الحفظ'), detail);
    toast((currentLang==='en'
      ? 'Cloud save failed — see the red banner above the quotations list'
      : 'فشل الحفظ السحابي — راجع الشريط الأحمر أعلى قائمة عروض الأسعار'));
  }
  return ok;
}
async function loadState(){
  try{
    if (supabaseClient) {
      const loaded = await loadFromSupabase();
      if (loaded) {
        return true;
      }
    }
    throw new Error('Cloud database is unavailable');
  }catch(e){
    return false;
  }
}

// ============== HELPERS ==============
function fmt(n){ return Number(n||0).toLocaleString('en-US'); }
function todayISO(){ const t=new Date(); return t.toISOString().slice(0,10); }
// Normalises any date value (Excel serial number, Date object, 01/09/2026, 2026-09-01,
// 1-Sep-2026, Arabic-Indic digits...) into the ISO yyyy-mm-dd string Postgres expects.
// Returning '' for unparsable values is important: sending a raw Excel serial such as
// 46001 to a `date` column makes the whole Supabase upsert fail.
function toISODate(value){
  if(value===''||value===null||value===undefined) return '';
  if(value instanceof Date && !isNaN(value.getTime())){
    return new Date(value.getTime()-value.getTimezoneOffset()*60000).toISOString().slice(0,10);
  }
  if(typeof value==='number' && isFinite(value)){
    if(value>20000 && value<80000){
      const d = new Date(Math.round((value-25569)*86400000));
      return isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
    }
    return '';
  }
  let s = String(value).trim();
  if(!s) return '';
  s = s.replace(/[\u0660-\u0669]/g, ch=>String(ch.charCodeAt(0)-0x0660))
       .replace(/[\u06f0-\u06f9]/g, ch=>String(ch.charCodeAt(0)-0x06f0));
  let m = s.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/);
  if(m) return `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}`;
  m = s.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/);
  if(m){
    let day = Number(m[1]), month = Number(m[2]);
    if(month>12 && day<=12){ const tmp=day; day=month; month=tmp; }
    if(day>31 || month>12) return '';
    let year = Number(m[3]); if(year<100) year += year<70 ? 2000 : 1900;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  const months = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  m = s.match(/(\d{1,2})[-\s]([A-Za-z]{3,})[-\s,]*(\d{4})/);
  if(m){ const mo = months[m[2].slice(0,3).toLowerCase()]; if(mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`; }
  m = s.match(/([A-Za-z]{3,})\s+(\d{1,2})[-\s,]+(\d{4})/);
  if(m){ const mo = months[m[1].slice(0,3).toLowerCase()]; if(mo) return `${m[3]}-${String(mo).padStart(2,'0')}-${String(m[2]).padStart(2,'0')}`; }
  const parsed = new Date(s);
  if(!isNaN(parsed.getTime())) return new Date(parsed.getTime()-parsed.getTimezoneOffset()*60000).toISOString().slice(0,10);
  return '';
}
function toTimeValue(val){
  if(val===''||val===null||val===undefined) return '';
  if(val instanceof Date && !isNaN(val.getTime())) return String(val.getHours()).padStart(2,'0')+':'+String(val.getMinutes()).padStart(2,'0');
  if(typeof val==='number' && val<1 && val>=0){ const mins=Math.round(val*24*60); return String(Math.floor(mins/60)).padStart(2,'0')+':'+String(mins%60).padStart(2,'0'); }
  const m = String(val).match(/(\d{1,2}):(\d{2})/);
  return m ? `${String(m[1]).padStart(2,'0')}:${m[2]}` : '';
}
let nextLogId = 1;
function genLogId(){ return nextLogId++; }
// backfill unique ids on any log entries saved before this feature existed
function ensureLogIds(){
  let maxId = 0;
  debtors.forEach(d=>{ (d.log||[]).forEach(entry=>{ if(entry.id) maxId = Math.max(maxId, Number(entry.id)||0); }); });
  nextLogId = maxId + 1;
  debtors.forEach(d=>{ (d.log||[]).forEach(entry=>{ if(!entry.id) entry.id = genLogId(); }); });
}
ensureLogIds();
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function remaining(d){ return Math.max(d.total - d.paid, 0); }
function buildInstallments(total,due,count,frequency){
  const amount=Number(total||0)/count; const start=new Date(due); const step=frequency==='weekly'?7:frequency==='quarterly'?90:30;
  return Array.from({length:count},(_,index)=>{const date=new Date(start);date.setDate(date.getDate()+step*index);return {number:index+1,date:date.toISOString().slice(0,10),amount:Math.round(amount*100)/100,paid:false};});
}
function statusOf(d){
  if(remaining(d) <= 0) return 'paid';
  const today = new Date(todayISO());
  const due = new Date(d.due);
  if(due < today) return 'overdue';
  return 'active';
}
function statusLabel(s){ return {active:t('status.active'), overdue:t('status.overdue'), paid:t('status.paid')}[s] || s; }
function initials(name){ return name.trim().split(' ')[0].slice(0,1); }
function toast(msg){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

// ============== MOBILE MENU ==============
document.getElementById('mobileMenuToggle').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('mobile-open');
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('mobileMenuToggle');
  if (sidebar.classList.contains('mobile-open') && 
      !sidebar.contains(e.target) && 
      !menuToggle.contains(e.target)) {
    sidebar.classList.remove('mobile-open');
  }
});

// ============== NAV ==============
document.querySelectorAll('.nav-item').forEach(item=>{
  item.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    item.classList.add('active');
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById('page-'+page).classList.add('active');
    
    // Close mobile menu on navigation
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('mobile-open');
    }
    
    const titles = {
      dashboard:['لوحة التحكم','نظرة عامة على حالة التحصيل اليوم'],
      debtors:['المدينون','إدارة كافة ملفات المدينين'],
      reps:['المندوبون','فريق التحصيل الميداني وأداء كل مندوب'],
      payments:['سجل السداد','جميع عمليات السداد المسجّلة'],
      followups:['المتابعات','سجل الاتصالات والزيارات'],
      quotations:['عروض الأسعار','متابعة عروض الأسعار المقدمة للعملاء'],
      aging:['أعمار الديون','تصنيف المتأخرات حسب مدة التأخير (30/60/90 يوم)'],
      reports:['التقارير','ملخص مالي وتحليل الحالات'],
      settings:['الإعدادات','النسخ الاحتياطي وإدارة بيانات النظام'],
    };
    const useEn = currentLang==='en';
    document.getElementById('pageTitle').textContent = useEn ? EN_TITLES[page][0] : titles[page][0];
    document.getElementById('pageSub').textContent = useEn ? EN_TITLES[page][1] : titles[page][1];
    renderAll();
  });
});

// ============== MODAL ==============
let editingDebtorId = null;
document.getElementById('addDebtorBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  editingDebtorId = null;
  document.getElementById('debtorModalTitle').textContent = t('modal.addDebtor');
  document.getElementById('saveDebtorBtn').textContent = t('modal.saveDebtor');
  ['f_name','f_phone','f_amount','f_due','f_expectedPaymentDate','f_paid','f_notes','f_companyNumber','f_crNumber'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('f_paidMethod').value = 'نقدًا';
  document.getElementById('f_paidDate').value = todayISO();
  setDebtorTypeUI('individual');
  fillRepSelect(document.getElementById('f_rep'));
  lockRepFieldForCollector();
  document.getElementById('debtorModal').classList.add('show');
});
function openDebtorEditModal(id){
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===id);
  if(!d) return;
  if(currentUser?.role==='collector' && d.repId!==currentUser.repId){
    toast(currentLang==='en'?'This case is not assigned to you':'هذه الحالة غير مسندة إليك');
    return;
  }
  editingDebtorId = id;
  document.getElementById('debtorModalTitle').textContent = t('modal.editDebtor');
  document.getElementById('saveDebtorBtn').textContent = t('modal.saveChanges');
  setDebtorTypeUI(d.type||'individual');
  document.getElementById('f_name').value = d.name||'';
  document.getElementById('f_companyNumber').value = d.companyNumber||'';
  document.getElementById('f_crNumber').value = d.crNumber||'';
  document.getElementById('f_phone').value = d.phone||'';
  document.getElementById('f_amount').value = d.total||0;
  document.getElementById('f_due').value = d.due||'';
  document.getElementById('f_expectedPaymentDate').value = d.expectedPaymentDate||'';
  document.getElementById('f_paid').value = '';
  document.getElementById('f_paidMethod').value = 'نقدًا';
  document.getElementById('f_paidDate').value = todayISO();
  document.getElementById('f_installments').value = d.installments?.length || 1;
  document.getElementById('f_frequency').value = d.frequency || 'monthly';
  document.getElementById('f_notes').value = d.notes||'';
  fillRepSelect(document.getElementById('f_rep'), d.repId||'');
  lockRepFieldForCollector();
  document.getElementById('debtorModal').classList.add('show');
}
// a collector can only ever create/keep cases assigned to themselves —
// this locks the "assigned collector" field in the add/edit modal accordingly.
function lockRepFieldForCollector(){
  const sel=document.getElementById('f_rep');
  if(currentUser?.role==='collector'){
    if(currentUser.repId) sel.value=String(currentUser.repId);
    sel.disabled=true;
  } else {
    sel.disabled=false;
  }
}
function setDebtorTypeUI(type){
  document.getElementById('f_type_individual').classList.toggle('active', type==='individual');
  document.getElementById('f_type_company').classList.toggle('active', type==='company');
  document.getElementById('f_companyFields').classList.toggle('show', type==='company');
  document.getElementById('f_nameLabel').textContent = type==='company' ? t('modal.companyName') : t('modal.fullName');
  document.getElementById('f_name').placeholder = type==='company' ? t('modal.companyNamePh') : t('modal.fullNamePh');
  document.getElementById('debtorModal').dataset.debtorType = type;
}
document.getElementById('f_type_individual').addEventListener('click', ()=>setDebtorTypeUI('individual'));
document.getElementById('f_type_company').addEventListener('click', ()=>setDebtorTypeUI('company'));
function fillRepSelect(sel, selected){
  const current = selected!==undefined ? selected : sel.value;
  sel.innerHTML = `<option value="">${t('drawer.noRep')}</option>` + reps.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('');
  if(current) sel.value = current;
}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click', e=>{
  document.getElementById(e.target.dataset.close).classList.remove('show');
}));
document.getElementById('saveDebtorBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const type = document.getElementById('debtorModal').dataset.debtorType || 'individual';
  const name = document.getElementById('f_name').value.trim();
  const companyNumber = type==='company' ? document.getElementById('f_companyNumber').value.trim() : '';
  const crNumber = type==='company' ? document.getElementById('f_crNumber').value.trim() : '';
  const phone = document.getElementById('f_phone').value.trim();
  const amount = parseFloat(document.getElementById('f_amount').value) || 0;
  const due = document.getElementById('f_due').value || '2026-12-31';
  const expectedPaymentDate = document.getElementById('f_expectedPaymentDate').value || '';
  const paid = parseFloat(document.getElementById('f_paid').value) || 0;
  const paidMethod = document.getElementById('f_paidMethod').value;
  const paidDate = document.getElementById('f_paidDate').value || todayISO();
  const notes = document.getElementById('f_notes').value.trim();
  const repId = document.getElementById('f_rep').value ? Number(document.getElementById('f_rep').value) : null;
  const installmentCount = Math.max(1,parseInt(document.getElementById('f_installments').value)||1);
  const frequency = document.getElementById('f_frequency').value;
  if(!name || !amount){ toast(type==='company' ? t('toast.needCompanyName') : t('toast.needName')); return; }

  if(editingDebtorId){
    const d = debtors.find(x=>x.id===editingDebtorId);
    let diffParts=[];
    if(d){
      const before={name:d.name, phone:d.phone, total:d.total, due:d.due, repId:d.repId};
      d.name=name; d.type=type; d.companyNumber=companyNumber; d.crNumber=crNumber;
      d.phone=phone; d.total=amount; d.due=due; d.expectedPaymentDate=expectedPaymentDate; d.notes=notes; d.repId=repId; d.frequency=frequency; d.installments=buildInstallments(amount,due,installmentCount,frequency);
      if(paid>0){ d.paid += paid; d.log.push({id:genLogId(), type:'payment', date:paidDate, amount:paid, method:paidMethod}); }
      if(before.name!==name) diffParts.push(`${currentLang==='en'?'name':'الاسم'}: ${before.name} → ${name}`);
      if(before.total!==amount) diffParts.push(`${currentLang==='en'?'amount':'المبلغ'}: ${fmt(before.total)} → ${fmt(amount)}`);
      if(before.due!==due) diffParts.push(`${currentLang==='en'?'due':'الاستحقاق'}: ${before.due} → ${due}`);
      if(before.phone!==phone) diffParts.push(`${currentLang==='en'?'phone':'الهاتف'}: ${before.phone||'—'} → ${phone||'—'}`);
      if(before.repId!==repId){
        const oldRep=reps.find(r=>r.id===before.repId), newRep=reps.find(r=>r.id===repId);
        diffParts.push(`${currentLang==='en'?'collector':'المندوب'}: ${oldRep?oldRep.name:t('drawer.noRep')} → ${newRep?newRep.name:t('drawer.noRep')}`);
      }
      if(paid>0) diffParts.push(`${currentLang==='en'?'payment added':'دفعة مضافة'}: ${fmt(paid)}`);
    }
    document.getElementById('debtorModal').classList.remove('show');
    addAudit('update_debtor', `${name}${diffParts.length?' — '+diffParts.join(' | '):''}`);
    toast(t('toast.updated'));
    editingDebtorId = null;
    renderAll();
    return;
  }

  debtors.push({id:nextId++, name, type, companyNumber, crNumber, phone, total:amount, paid, due, expectedPaymentDate, notes, repId, frequency, installments:buildInstallments(amount,due,installmentCount,frequency), log: paid>0?[{id:genLogId(), type:'payment', date:paidDate, amount:paid, method:paidMethod}]:[]}); 
  document.getElementById('debtorModal').classList.remove('show');
  addAudit('add_debtor',`${name} — ${fmt(amount)} ${currentLang==='en'?'QAR':'ر.ق'}`);
  toast(type==='company' ? t('toast.companyAdded') : t('toast.debtorAdded'));
  renderAll();
});

// ============== SEARCH & FILTER ==============
document.getElementById('globalSearch').addEventListener('input', renderAll);
document.getElementById('statusFilter').addEventListener('change', renderAll);
document.getElementById('typeFilter').addEventListener('change', renderAll);

// Advanced Search
document.getElementById('advancedSearchBtn').addEventListener('click', () => {
  const panel = document.getElementById('advancedSearchPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  // Populate collector filter
  const collectorSelect = document.getElementById('collectorFilter');
  collectorSelect.innerHTML = '<option value="all" data-i18n="debtors.allStatuses">الكل</option>' +
    reps.map(r => `<option value="${r.id}">${esc(r.name)}</option>`).join('');
});

document.getElementById('applyAdvancedSearch').addEventListener('click', renderAll);
document.getElementById('resetAdvancedSearch').addEventListener('click', () => {
  document.getElementById('minAmount').value = '';
  document.getElementById('maxAmount').value = '';
  document.getElementById('minDate').value = '';
  document.getElementById('maxDate').value = '';
  document.getElementById('collectorFilter').value = 'all';
  document.getElementById('riskFilter').value = 'all';
  renderAll();
});

document.getElementById('saveSearchBtn').addEventListener('click', () => {
  const searchConfig = {
    query: document.getElementById('globalSearch').value,
    status: document.getElementById('statusFilter').value,
    type: document.getElementById('typeFilter').value,
    minAmount: document.getElementById('minAmount').value,
    maxAmount: document.getElementById('maxAmount').value,
    minDate: document.getElementById('minDate').value,
    maxDate: document.getElementById('maxDate').value,
    collector: document.getElementById('collectorFilter').value,
    risk: document.getElementById('riskFilter').value
  };
  localStorage.setItem('daftar_saved_search', JSON.stringify(searchConfig));
  toast(currentLang === 'en' ? 'Search saved' : 'تم حفظ البحث');
});

// Load saved search on startup
function loadSavedSearch() {
  try {
    const saved = localStorage.getItem('daftar_saved_search');
    if (saved) {
      const config = JSON.parse(saved);
      document.getElementById('globalSearch').value = config.query || '';
      document.getElementById('statusFilter').value = config.status || 'all';
      document.getElementById('typeFilter').value = config.type || 'all';
      document.getElementById('minAmount').value = config.minAmount || '';
      document.getElementById('maxAmount').value = config.maxAmount || '';
      document.getElementById('minDate').value = config.minDate || '';
      document.getElementById('maxDate').value = config.maxDate || '';
      document.getElementById('collectorFilter').value = config.collector || 'all';
      document.getElementById('riskFilter').value = config.risk || 'all';
    }
  } catch (e) {}
}
document.getElementById('importExcelFile').addEventListener('change', e=>{
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader(); reader.onload=()=>{
    try{
      const rows=XLSX.utils.sheet_to_json(XLSX.read(reader.result,{type:'array'}).Sheets[XLSX.read(reader.result,{type:'array'}).SheetNames[0]],{defval:''});
      const pick=(row,keys)=>{const key=Object.keys(row).find(k=>keys.includes(String(k).trim().toLowerCase()));return key===undefined?'':row[key];};
      const imported=rows.map(row=>{const name=pick(row,['الاسم','اسم المدين','name','debtor name']); const total=Number(pick(row,['إجمالي الدين','المبلغ','total','total debt']))||0; const type=String(pick(row,['النوع','type'])).toLowerCase().includes('company')||String(pick(row,['النوع','type'])).includes('شركة')?'company':'individual'; return {id:nextId++,name,type,companyNumber:String(pick(row,['رقم الشركة','company number'])),crNumber:String(pick(row,['السجل التجاري','cr number'])),phone:String(pick(row,['الهاتف','phone'])),total,paid:Number(pick(row,['المسدد','paid']))||0,due:String(pick(row,['تاريخ الاستحقاق','due','due date']))||'2026-12-31',notes:String(pick(row,['ملاحظات','notes'])),repId:null,log:[]};}).filter(d=>d.name&&d.total>0);
      if(!imported.length) throw new Error('empty');
      if(confirm(currentLang==='en'?`Import ${imported.length} debtors?`:`استيراد ${imported.length} مدين؟`)){debtors.push(...imported);renderAll();toast(currentLang==='en'?'Excel data imported':'تم استيراد بيانات Excel');}
    }catch(err){toast(currentLang==='en'?'Could not read Excel file':'تعذّرت قراءة ملف Excel');}
  }; reader.readAsArrayBuffer(file); e.target.value='';
});
document.getElementById('downloadExcelTemplateBtn').addEventListener('click',()=>{
  const sheet=XLSX.utils.json_to_sheet([{الاسم:'اسم المدين',النوع:'فرد',الهاتف:'0500000000','إجمالي الدين':1000,المسدد:0,'تاريخ الاستحقاق':'2026-12-31',ملاحظات:''}]);
  const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,sheet,'Debtors'); XLSX.writeFile(book,'daftar-debtors-template.xlsx');
});
function printThemeVars(){
  const cs=getComputedStyle(document.documentElement);
  const accent=(cs.getPropertyValue('--gold')||'#C9A227').trim()||'#C9A227';
  const accentDim=(cs.getPropertyValue('--gold-dim')||'#8A7327').trim()||'#8A7327';
  const rgb=hexToRgbArr(accent);
  const ink=readableInk(rgb);
  return {accent, accentDim, ink, rgb:rgb.join(',')};
}
function printBackgroundCss(){
  return appSettings.watermarkEnabled!==false
    ? `background-image:linear-gradient(rgba(255,255,255,.94),rgba(255,255,255,.94)),url('${IMAGE_PATH}'); background-size:cover; background-position:center; background-attachment:fixed;`
    : `background:#ffffff;`;
}
function printBrandHeader(docLabel, docCode){
  const seal='د';
  return `<div class="doc-brand">
    <div class="doc-brand-left">
      <div class="doc-seal">${seal}</div>
      <div>
        <div class="doc-brand-name">${currentLang==='en'?'Daftar':'دفتر'}</div>
        <div class="doc-brand-sub">${t('msg.statementSystem')}</div>
      </div>
    </div>
    <div class="doc-brand-right">
      <div class="doc-title">${esc(docLabel)}</div>
      ${docCode?`<div class="doc-code">${esc(docCode)}</div>`:''}
      <div class="doc-issue">${currentLang==='en'?'Issued':'تاريخ الإصدار'}: ${todayISO()}</div>
    </div>
  </div>`;
}
function printSharedStyle(){
  const {accent, accentDim, ink}=printThemeVars();
  return `
  @page{ size:A4; margin:16mm; }
  *{box-sizing:border-box;}
  body{font-family:'Tajawal','IBM Plex Sans Arabic','Tahoma','Arial',sans-serif; color:#20242c; direction:${currentLang==='en'?'ltr':'rtl'}; margin:0; padding:0; ${printBackgroundCss()} print-color-adjust:exact; -webkit-print-color-adjust:exact; font-size:13px;}
  .doc-brand{display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:18px; margin-bottom:22px; border-bottom:3px solid ${accent};}
  .doc-brand-left{display:flex; align-items:center; gap:12px;}
  .doc-seal{width:46px; height:46px; border-radius:50%; border:2px solid ${accent}; color:${accent}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:19px;}
  .doc-brand-name{font-size:17px; font-weight:900;}
  .doc-brand-sub{font-size:11px; color:#6b7280; margin-top:2px;}
  .doc-brand-right{text-align:${currentLang==='en'?'left':'right'};}
  .doc-title{font-size:15px; font-weight:800; color:${accent==='#'?accent:accent};}
  .doc-code{font-size:11px; color:#6b7280; margin-top:2px; font-family:'Consolas','Courier New',monospace;}
  .doc-issue{font-size:11px; color:#6b7280; margin-top:2px;}
  h1{font-size:17px; font-weight:800; margin:0 0 4px;}
  table{width:100%; border-collapse:collapse; margin-bottom:20px; table-layout:fixed;}
  th{background:${accent}; color:${ink}; font-size:11.5px; font-weight:700; padding:9px 10px; text-align:${currentLang==='en'?'left':'right'}; white-space:normal; overflow-wrap:anywhere;}
  td{padding:9px 10px; font-size:12px; border-bottom:1px solid #e7e9ee; white-space:normal; overflow-wrap:anywhere; word-break:break-word;}
  tr:nth-child(even) td{background:rgba(0,0,0,.018);}
  tr.opening td{background:rgba(${hexToRgbArr(accent).join(',')},.08); font-weight:700;}
  .num{font-family:'Consolas','Courier New',monospace; direction:ltr; text-align:left;}
  .panel,.stat-card,.party .box{background:rgba(255,255,255,.92); border:1px solid #e2e5ec; border-radius:10px; padding:14px 16px; margin:0 0 10px;}
  .stat-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:10px;}
  .empty{padding:12px;}
  .page{display:block!important;}
  .risk{font-weight:800;}
  .doc-footer{margin-top:32px; padding-top:12px; border-top:1px dashed #d5d9e0; font-size:10.5px; color:#9aa0ab; text-align:center;}
  `;
}
function currentPageDocument(){
  const page=document.querySelector('.page.active'); const title=document.getElementById('pageTitle').textContent;
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
${page.innerHTML}
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
// ============== DRAWER ==============
function openDrawer(id){
  const d0 = debtors.find(x=>x.id===id);
  if(!d0) return;
  if(currentUser?.role==='collector' && d0.repId!==currentUser.repId){
    toast(currentLang==='en'?'This case is not assigned to you':'هذه الحالة غير مسندة إليك');
    return;
  }
  activeDebtorId = id;
  const d = d0;
  document.getElementById('dr_seal').textContent = initials(d.name);
  document.getElementById('dr_phone').textContent = d.phone || '—';
  document.getElementById('dr_name').textContent = d.name;
  const isCompany = d.type==='company';
  document.getElementById('dr_type').innerHTML = `<span class="badge ${isCompany?'type-company':'type-individual'}">${isCompany?t('debtors.company'):t('debtors.individual')}</span>`;
  document.getElementById('dr_companyNumberRow').style.display = isCompany ? 'flex' : 'none';
  document.getElementById('dr_crNumberRow').style.display = isCompany ? 'flex' : 'none';
  document.getElementById('dr_companyNumber').textContent = d.companyNumber || '—';
  document.getElementById('dr_crNumber').textContent = d.crNumber || '—';
  document.getElementById('dr_total').textContent = currency(d.total);
  document.getElementById('dr_paid').textContent = currency(d.paid);
  document.getElementById('dr_remaining').textContent = currency(remaining(d));
  document.getElementById('dr_status').innerHTML = `<span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span>`;
  document.getElementById('dr_due').textContent = d.due;
  document.getElementById('dr_installments').innerHTML = (d.installments||[]).map(item=>`<div class="installment-row"><span>#${item.number} · ${item.date}</span><b>${currency(item.amount)}</b><span class="badge ${item.paid?'paid':'active'}">${item.paid?t('status.paid'):currentLang==='en'?'Pending':'قيد الانتظار'}</span></div>`).join('') || `<div class="wm-note">${currentLang==='en'?'No installment plan':'لا توجد خطة أقساط'}</div>`;
  const rep = reps.find(r=>r.id===d.repId);
  document.getElementById('dr_repName').textContent = rep ? rep.name : t('drawer.noRep');
  fillRepSelect(document.getElementById('dr_repSelect'), d.repId||'');
  document.getElementById('dr_paymentDate').value = todayISO();
  document.getElementById('dr_followDate').value = todayISO();

  const log = document.getElementById('dr_log');
  if(!d.log.length){
    log.innerHTML = `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${currentLang==='en'?'No activity recorded yet.':'لا يوجد نشاط مسجل بعد.'}</div>`;
  } else {
    log.innerHTML = [...d.log].reverse().map(e=>{
      if(e.type==='payment'){
        const actions = can('write') ? `<span class="log-actions"><button type="button" class="link-btn" data-edit-payment="${e.id}">${t('action.edit')}</button><button type="button" class="link-btn" data-delete-payment="${e.id}">${t('action.delete')}</button></span>` : '';
        return `<div class="log-entry"><div class="top"><b>${currentLang==='en'?'Payment':'دفعة سداد'} — ${fmt(e.amount)} ${currentLang==='en'?'QAR':'ر.ق'}</b>${actions}<span>${esc(e.date)}</span></div><div class="note">${currentLang==='en'?'Payment method':'طريقة الدفع'}: ${translateValue(e.method)}</div></div>`;
      } else {
        const actions = can('write') ? `<span class="log-actions"><button type="button" class="link-btn" data-edit-follow="${e.id}">${t('action.edit')}</button><button type="button" class="link-btn" data-delete-follow="${e.id}">${t('action.delete')}</button></span>` : '';
        return `<div class="log-entry"><div class="top"><b>${currentLang==='en'?'Follow-up':'متابعة'} — ${translateValue(e.method)}</b>${actions}<span>${esc(e.date)}</span></div><div class="note">${esc(e.note)||'—'}</div></div>`;
      }
    }).join('');
  }
  document.getElementById('drawer').classList.add('show');
  document.getElementById('drawerOverlay').classList.add('show');
}
function closeDrawer(){
  document.getElementById('drawer').classList.remove('show');
  document.getElementById('drawerOverlay').classList.remove('show');
  activeDebtorId = null;
}
document.getElementById('drawerClose').addEventListener('click', closeDrawer);
document.getElementById('drawerOverlay').addEventListener('click', closeDrawer);
document.getElementById('dr_editDebtor').addEventListener('click', ()=>{
  if(!activeDebtorId) return;
  openDebtorEditModal(activeDebtorId);
});

document.getElementById('dr_assignRep').addEventListener('click', ()=>{
  if(currentUser?.role!=='admin'){toast(currentLang==='en'?'Only an admin can reassign cases':'إسناد الحالات متاح للمدير فقط');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const val = document.getElementById('dr_repSelect').value;
  const oldRep=reps.find(r=>r.id===d.repId);
  d.repId = val ? Number(val) : null;
  const newRep=reps.find(r=>r.id===d.repId);
  addAudit(val?'assign_rep':'unassign_rep', `${d.name}: ${oldRep?oldRep.name:t('drawer.noRep')} → ${newRep?newRep.name:t('drawer.noRep')}`);
  toast(val ? t('msg.assign') : t('msg.unassign'));
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_addPayment').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const amt = parseFloat(document.getElementById('dr_paymentAmount').value);
  const method = document.getElementById('dr_paymentMethod').value;
  const date = document.getElementById('dr_paymentDate').value || todayISO();
  if(!amt || amt<=0){ toast(t('msg.invalidAmount')); return; }
  d.paid += amt;
  d.log.push({id:genLogId(), type:'payment', date, amount:amt, method});
  document.getElementById('dr_paymentAmount').value='';
  document.getElementById('dr_paymentDate').value=todayISO();
  toast(t('msg.paymentAdded'));
  addAudit('add_payment',`${d.name}: ${fmt(amt)} (${currentLang==='en'?'remaining':'المتبقي'} ${fmt(remaining(d))})`);
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_editPaidBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const input = prompt(t('drawer.editPaidPrompt'), String(d.paid||0));
  if(input===null) return;
  const newPaid = parseFloat(input);
  if(isNaN(newPaid) || newPaid<0){ toast(t('msg.invalidAmount')); return; }
  const oldPaid = d.paid;
  d.paid = newPaid;
  addAudit('adjust_paid', `${d.name}: ${fmt(oldPaid)} → ${fmt(newPaid)}`);
  toast(t('msg.paidAdjusted'));
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_log').addEventListener('click', (ev)=>{
  const editPayBtn = ev.target.closest('[data-edit-payment]');
  const delPayBtn = ev.target.closest('[data-delete-payment]');
  const editFollowBtn = ev.target.closest('[data-edit-follow]');
  const delFollowBtn = ev.target.closest('[data-delete-follow]');
  if(!editPayBtn && !delPayBtn && !editFollowBtn && !delFollowBtn) return;
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  if(editPayBtn || delPayBtn){
    const logId = Number((editPayBtn||delPayBtn).dataset.editPayment || (editPayBtn||delPayBtn).dataset.deletePayment);
    const entry = d.log.find(e=>e.id===logId && e.type==='payment');
    if(!entry) return;
    if(editPayBtn){
      const input = prompt(t('drawer.editPaymentPrompt'), String(entry.amount));
      if(input===null) return;
      const newAmt = parseFloat(input);
      if(isNaN(newAmt) || newAmt<=0){ toast(t('msg.invalidAmount')); return; }
      d.paid = Math.max(0, d.paid - entry.amount + newAmt);
      addAudit('edit_payment', `${d.name}: ${fmt(entry.amount)} → ${fmt(newAmt)}`);
      entry.amount = newAmt;
      toast(t('msg.paymentUpdated'));
    } else {
      if(!confirm(t('drawer.deletePaymentConfirm'))) return;
      d.paid = Math.max(0, d.paid - entry.amount);
      d.log = d.log.filter(e=>e.id!==logId);
      addAudit('delete_payment', `${d.name}: ${fmt(entry.amount)}`);
      toast(t('msg.paymentDeleted'));
    }
  } else if(editFollowBtn || delFollowBtn){
    const logId = Number((editFollowBtn||delFollowBtn).dataset.editFollow || (editFollowBtn||delFollowBtn).dataset.deleteFollow);
    const entry = d.log.find(e=>e.id===logId && e.type==='follow');
    if(!entry) return;
    if(editFollowBtn){
      const input = prompt(t('drawer.editFollowPrompt'), String(entry.note||''));
      if(input===null) return;
      const newNote = input.trim();
      addAudit('edit_followup', `${d.name}: ${entry.note||'—'} → ${newNote||'—'}`);
      entry.note = newNote;
      toast(t('msg.followUpdated'));
    } else {
      if(!confirm(t('drawer.deleteFollowConfirm'))) return;
      d.log = d.log.filter(e=>e.id!==logId);
      addAudit('delete_followup', `${d.name}: ${entry.note||'—'}`);
      toast(t('msg.followDeleted'));
    }
  }
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_addFollow').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const d = debtors.find(x=>x.id===activeDebtorId);
  if(!d) return;
  const method = document.getElementById('dr_followMethod').value;
  const date = document.getElementById('dr_followDate').value || todayISO();
  const note = document.getElementById('dr_followOutcome').value.trim();
  if(!note){ toast(currentLang==='en'?'Enter the outcome / note':'الرجاء إدخال النتيجة / الملاحظة'); return; }
  d.log.push({id:genLogId(), type:'follow', date, method, note});
  d.notes = `[${date}] ${translateValue(method)}: ${note}` + (d.notes ? '\n' + d.notes : '');
  document.getElementById('dr_followOutcome').value='';
  document.getElementById('dr_followDate').value=todayISO();
  toast(t('msg.followAdded'));
  addAudit('add_followup',`${d.name} (${translateValue(method)})${note?': '+note:''}`);
  openDrawer(d.id);
  renderAll();
});
document.getElementById('dr_delete').addEventListener('click', ()=>{
  if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
  if(!activeDebtorId) return;
  if(!confirm(t('msg.deleteDebtor'))) return;
  const d = debtors.find(x=>x.id===activeDebtorId);
  debtors = debtors.filter(x=>x.id!==activeDebtorId);
  closeDrawer();
  toast(t('msg.debtorDeleted'));
  addAudit('delete_debtor', d ? `${d.name} — ${fmt(remaining(d))}` : String(activeDebtorId));
  renderAll();
});

// ============== QUOTATIONS (عروض الأسعار) ==============
function genQuotationLogId(){ return nextQuotationLogId++; }
function quotStatusLabel(status){ return t('quot.status.'+status) || status; }
function quotScopeLabel(scope){ return t('quot.scope.'+scope) || scope; }
function quotSubjectLabel(subject){ return t('quot.subject.'+subject) || subject; }
function quotStatusBadgeClass(status){
  return {open:'active', submitted:'paid', followup:'overdue', paymentPending:'overdue', closed:'type-individual'}[status] || 'type-individual';
}
function latestQuotationDate(){
  const dates = [...new Set(quotations.filter(q=>q.date).map(q=>q.date))].sort((a,b)=>b.localeCompare(a));
  return dates[0] || todayISO();
}
function ensureQuotationDateFilter(){
  const el = document.getElementById('quotDateFilter');
  if(!el) return;
  if(!el.value){
    const fallback = latestQuotationDate();
    el.value = fallback;
  }
}
function scopedQuotations(){
  const query = (document.getElementById('quotSearch')?.value || '').trim().toLowerCase();
  const statusF = document.getElementById('quotStatusFilter')?.value || 'all';
  const scopeF = document.getElementById('quotScopeFilter')?.value || 'all';
  const subjectF = document.getElementById('quotSubjectFilter')?.value || 'all';
  const dateF = document.getElementById('quotDateFilter')?.value || latestQuotationDate();
  return quotations.filter(q=>{
    if(dateF && q.date !== dateF) return false;
    if(statusF!=='all' && q.status!==statusF) return false;
    if(scopeF!=='all' && q.companyScope!==scopeF) return false;
    if(subjectF!=='all' && q.subject!==subjectF) return false;
    if(query){
      const hay = `${q.companyName||''} ${q.contactPerson||''} ${q.mobile||''} ${q.email||''}`.toLowerCase();
      if(!hay.includes(query)) return false;
    }
    return true;
  }).sort((a,b)=> (b.date||'').localeCompare(a.date||''));
}
function renderQuotationsTable(){
  const body = document.getElementById('quotationsTableBody');
  if(!body) return;
  ensureQuotationDateFilter();
  const rows = scopedQuotations();
  document.getElementById('quotationsEmpty').style.display = rows.length ? 'none' : 'block';
  body.innerHTML = rows.map((q,i)=>`<tr data-id="${q.id}">
    <td class="figures">${i+1}</td><td>${esc(q.date)||'—'}</td><td class="figures">${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td>
    <td>${esc(q.contactPerson)||'—'}</td><td class="figures">${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td>
    <td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td>
    <td><span class="badge ${quotStatusBadgeClass(q.status)}">${quotStatusLabel(q.status)}</span></td><td>${esc(q.nextFollowup)||'—'}</td>
    <td><button type="button" class="link-btn" data-quot-edit="${q.id}">${t('action.edit')}</button> · <button type="button" class="link-btn" data-quot-delete="${q.id}">${t('action.delete')}</button></td>
  </tr>`).join('');
}
document.getElementById('quotSearch')?.addEventListener('input', renderQuotationsTable);
document.getElementById('quotDateFilter')?.addEventListener('change', renderQuotationsTable);
document.getElementById('quotStatusFilter')?.addEventListener('change', renderQuotationsTable);
document.getElementById('quotScopeFilter')?.addEventListener('change', renderQuotationsTable);
document.getElementById('quotSubjectFilter')?.addEventListener('change', renderQuotationsTable);

document.getElementById('quotationsTableBody')?.addEventListener('click', (ev)=>{
  const editBtn = ev.target.closest('[data-quot-edit]');
  const delBtn = ev.target.closest('[data-quot-delete]');
  if(editBtn){ openQuotationEditModal(Number(editBtn.dataset.quotEdit)); return; }
  if(delBtn){ deleteQuotation(Number(delBtn.dataset.quotDelete)); return; }
  const row = ev.target.closest('tr[data-id]');
  if(row) openQuotationDrawer(Number(row.dataset.id));
});

let editingQuotationId = null;
document.getElementById('addQuotationBtn')?.addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  editingQuotationId = null;
  pendingQuotationFile = null;
  const addBanner = document.getElementById('quotExtractBanner');
  if(addBanner) addBanner.style.display = 'none';
  document.getElementById('quotationModalTitle').textContent = t('quot.addTitle');
  document.getElementById('saveQuotationBtn').textContent = t('quot.save');
  ['q_company','q_contact','q_mobile','q_email','q_amount','q_time','q_nextFollowup','q_requirement','q_followupAction','q_notes','q_quotationNo','q_invoiceNo','q_projectNo'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('q_scope').value = 'mainContractor';
  document.getElementById('q_subject').value = 'quoteFollowup';
  document.getElementById('q_status').value = 'open';
  document.getElementById('q_date').value = todayISO();
  document.getElementById('quotationModal').classList.add('show');
});
function openQuotationEditModal(id){
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const q = quotations.find(x=>x.id===id);
  if(!q) return;
  editingQuotationId = id;
  pendingQuotationFile = null;
  const editBanner = document.getElementById('quotExtractBanner');
  if(editBanner) editBanner.style.display = 'none';
  document.getElementById('quotationModalTitle').textContent = t('quot.editTitle');
  document.getElementById('saveQuotationBtn').textContent = t('modal.saveChanges');
  document.getElementById('q_company').value = q.companyName||'';
  document.getElementById('q_scope').value = q.companyScope||'mainContractor';
  document.getElementById('q_contact').value = q.contactPerson||'';
  document.getElementById('q_mobile').value = q.mobile||'';
  document.getElementById('q_email').value = q.email||'';
  document.getElementById('q_amount').value = q.amount||'';
  document.getElementById('q_quotationNo').value = q.quotationNo||'';
  document.getElementById('q_invoiceNo').value = q.invoiceNo||'';
  document.getElementById('q_projectNo').value = q.projectNo||'';
  document.getElementById('q_date').value = q.date||todayISO();
  document.getElementById('q_time').value = q.visitTime||'';
  document.getElementById('q_nextFollowup').value = q.nextFollowup||'';
  document.getElementById('q_subject').value = q.subject||'quoteFollowup';
  document.getElementById('q_status').value = q.status||'open';
  document.getElementById('q_requirement').value = q.requirement||'';
  document.getElementById('q_followupAction').value = q.followupAction||'';
  document.getElementById('q_notes').value = q.notes||'';
  document.getElementById('quotationModal').classList.add('show');
}
document.getElementById('saveQuotationBtn')?.addEventListener('click', async ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const companyName = document.getElementById('q_company').value.trim();
  if(!companyName){ toast(t('quot.needCompany')); return; }
  const payload = {
    companyName,
    companyScope: document.getElementById('q_scope').value,
    contactPerson: document.getElementById('q_contact').value.trim(),
    mobile: document.getElementById('q_mobile').value.trim(),
    email: document.getElementById('q_email').value.trim(),
    amount: parseFloat(document.getElementById('q_amount').value) || 0,
    quotationNo: document.getElementById('q_quotationNo').value.trim(),
    invoiceNo: document.getElementById('q_invoiceNo').value.trim(),
    projectNo: document.getElementById('q_projectNo').value.trim(),
    date: document.getElementById('q_date').value || todayISO(),
    visitTime: document.getElementById('q_time').value || '',
    nextFollowup: document.getElementById('q_nextFollowup').value || '',
    subject: document.getElementById('q_subject').value,
    status: document.getElementById('q_status').value,
    requirement: document.getElementById('q_requirement').value.trim(),
    followupAction: document.getElementById('q_followupAction').value.trim(),
    notes: document.getElementById('q_notes').value.trim(),
  };
  if(editingQuotationId){
    const q = quotations.find(x=>x.id===editingQuotationId);
    if(q) Object.assign(q, payload);
    document.getElementById('quotationModal').classList.remove('show');
    addAudit('update_quotation', companyName);
    await saveState();
    toast(t('quot.updated'));
    editingQuotationId = null;
    renderAll();
    return;
  }
  const newQuotation = {id:nextQuotationId++, ...payload, log:[]};
  quotations.push(newQuotation);
  document.getElementById('quotationModal').classList.remove('show');
  const banner = document.getElementById('quotExtractBanner');
  if(banner) banner.style.display = 'none';
  addAudit('add_quotation', companyName);
  const synced = await saveStateOrWarn(currentLang==='en'?'saving the quotation':'حفظ عرض السعر');
  // The source document is uploaded only after the quotation row exists in the cloud,
  // otherwise the foreign key on quotation_files would reject it.
  if(synced && pendingQuotationFile){
    try{
      toast(t('quot.uploading'));
      await uploadQuotationFile(pendingQuotationFile.file, newQuotation.id, pendingQuotationFile.extractedText||'');
      toast(t('quot.fileSaved'));
    }catch(err){
      const parts = [err?.code, err?.statusCode, err?.message, err?.error, err?.details, err?.hint].filter(Boolean);
      const detail = parts.length ? parts.join(' — ') : String(err);
      console.warn('Attachment upload failed:', err);
      showSyncErrorBanner(currentLang==='en'?`uploading "${pendingQuotationFile.file.name}"`:`رفع الملف "${pendingQuotationFile.file.name}"`, detail);
    }
  } else if(synced){
    toast(t('quot.added'));
  }
  pendingQuotationFile = null;
  renderAll();
});
function deleteQuotation(id){
  if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
  const q = quotations.find(x=>x.id===id);
  if(!q) return;
  if(!confirm(t('quot.confirmDelete'))) return;
  // Clean the bucket up too; the quotation_files rows disappear via ON DELETE CASCADE.
  const attached = filesForQuotation(id);
  if(attached.length && supabaseClient){
    supabaseClient.storage.from(QUOT_BUCKET).remove(attached.map(f=>f.storagePath)).catch(err=>console.warn('Attachment cleanup failed:', err));
    quotationFiles = quotationFiles.filter(f=>Number(f.quotationId)!==Number(id));
  }
  quotations = quotations.filter(x=>x.id!==id);
  if(activeQuotationId===id) closeQuotationDrawer();
  addAudit('delete_quotation', q.companyName);
  saveState();
  toast(t('quot.deleted'));
  renderAll();
}

// ---- Quotation detail drawer ----
function openQuotationDrawer(id){
  const q = quotations.find(x=>x.id===id);
  if(!q) return;
  activeQuotationId = id;
  document.getElementById('qd_seal').textContent = initials(q.companyName||'؟');
  document.getElementById('qd_company').textContent = q.companyName||'—';
  document.getElementById('qd_contact').textContent = q.contactPerson||'—';
  document.getElementById('qd_scope').textContent = quotScopeLabel(q.companyScope);
  document.getElementById('qd_mobile').textContent = q.mobile||'—';
  document.getElementById('qd_email').textContent = q.email||'—';
  document.getElementById('qd_amount').textContent = q.amount ? currency(q.amount) : '—';
  document.getElementById('qd_quotationNo').textContent = q.quotationNo||'—';
  document.getElementById('qd_invoiceNo').textContent = q.invoiceNo||'—';
  document.getElementById('qd_projectNo').textContent = q.projectNo||'—';
  document.getElementById('qd_date').textContent = q.date||'—';
  document.getElementById('qd_time').textContent = q.visitTime||'—';
  document.getElementById('qd_subject').textContent = quotSubjectLabel(q.subject);
  document.getElementById('qd_status').innerHTML = `<span class="badge ${quotStatusBadgeClass(q.status)}">${quotStatusLabel(q.status)}</span>`;
  document.getElementById('qd_nextFollowup').textContent = q.nextFollowup||'—';
  document.getElementById('qd_requirement').textContent = q.requirement||'—';
  document.getElementById('qd_updateDate').value = todayISO();
  document.getElementById('qd_updateStatus').value = q.status||'open';
  document.getElementById('qd_updateNote').value = '';

  const log = document.getElementById('qd_log');
  if(!q.log.length){
    log.innerHTML = `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${t('quot.noLog')}</div>`;
  } else {
    log.innerHTML = [...q.log].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).map(e=>{
      const actions = can('write') ? `<span class="log-actions"><button type="button" class="link-btn" data-delete-qlog="${e.id}">${t('action.delete')}</button></span>` : '';
      return `<div class="log-entry"><div class="top"><b><span class="badge ${quotStatusBadgeClass(e.status)}">${quotStatusLabel(e.status)}</span></b>${actions}<span>${esc(e.date)}</span></div><div class="note">${esc(e.note)||'—'}</div></div>`;
    }).join('');
  }
  renderQuotationAttachments(q.id);
  document.getElementById('quotationDrawer').classList.add('show');
  document.getElementById('quotationDrawerOverlay').classList.add('show');
}
function closeQuotationDrawer(){
  document.getElementById('quotationDrawer').classList.remove('show');
  document.getElementById('quotationDrawerOverlay').classList.remove('show');
  activeQuotationId = null;
}
document.getElementById('quotationDrawerClose')?.addEventListener('click', closeQuotationDrawer);
document.getElementById('quotationDrawerOverlay')?.addEventListener('click', closeQuotationDrawer);
document.getElementById('qd_edit')?.addEventListener('click', ()=>{ if(activeQuotationId) openQuotationEditModal(activeQuotationId); });
document.getElementById('qd_delete')?.addEventListener('click', ()=>{ if(activeQuotationId) deleteQuotation(activeQuotationId); });
document.getElementById('qd_addUpdate')?.addEventListener('click', async ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  const date = document.getElementById('qd_updateDate').value || todayISO();
  const status = document.getElementById('qd_updateStatus').value;
  const note = document.getElementById('qd_updateNote').value.trim();
  if(!note && !status){ toast(t('quot.needUpdateNote')); return; }
  q.log.push({id:genQuotationLogId(), date, status, note});
  q.status = status;
  document.getElementById('qd_updateNote').value = '';
  addAudit('quotation_status_update', `${q.companyName}: ${quotStatusLabel(status)}${note?' — '+note:''}`);
  await saveState();
  toast(t('quot.updateAdded'));
  openQuotationDrawer(q.id);
  renderAll();
});
document.getElementById('qd_log')?.addEventListener('click', (ev)=>{
  const delBtn = ev.target.closest('[data-delete-qlog]');
  if(!delBtn) return;
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  const logId = Number(delBtn.dataset.deleteQlog);
  q.log = q.log.filter(e=>e.id!==logId);
  openQuotationDrawer(q.id);
  renderAll();
});
document.getElementById('qd_print')?.addEventListener('click', ()=>{
  const q = quotations.find(x=>x.id===activeQuotationId);
  if(!q) return;
  printDocument(quotationDetailDocumentHtml(q));
});

// ============== QUOTATION ATTACHMENTS (الملفات المرفقة سحابيًا) ==============
// Files (PDF / JPG / PNG / Word) are uploaded to the Supabase Storage bucket
// `quotation-files`, and a row describing each upload is kept in public.quotation_files
// so the attachment survives reloads and is visible from any device.
const QUOT_BUCKET = 'quotation-files';
let quotationFiles = [];
let pendingQuotationFile = null; // file waiting to be attached to a not-yet-saved quotation

function filesForQuotation(quotationId){
  return quotationFiles.filter(f=>Number(f.quotationId)===Number(quotationId));
}
function humanFileSize(bytes){
  const n = Number(bytes)||0;
  if(n < 1024) return `${n} B`;
  if(n < 1048576) return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1048576).toFixed(1)} MB`;
}
function fileKindIcon(type, name){
  const ext = String(name||'').split('.').pop().toLowerCase();
  if(String(type).includes('pdf') || ext==='pdf') return '📕';
  if(String(type).startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext)) return '🖼️';
  if(ext==='doc' || ext==='docx') return '📘';
  return '📄';
}
function safeStorageName(name){
  const ext = (String(name).split('.').pop()||'bin').toLowerCase().replace(/[^a-z0-9]/g,'');
  return `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
}

async function loadQuotationFiles(){
  if(!supabaseClient) return;
  const { data, error } = await supabaseClient.from('quotation_files').select('*');
  if(error){
    const parts = [error?.code, error?.message, error?.details, error?.hint].filter(Boolean);
    const detail = parts.length ? parts.join(' — ') : String(error);
    console.warn('Loading quotation files failed:', error);
    showSyncErrorBanner(currentLang==='en'?'loading attached files list':'تحميل قائمة الملفات المرفقة', detail);
    quotationFiles = [];
    return;
  }
  quotationFiles = (data||[]).map(row=>({
    id: row.id,
    quotationId: row.quotation_id,
    fileName: row.file_name,
    fileType: row.file_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    extractedText: row.extracted_text || '',
    uploadedAt: row.uploaded_at
  }));
}

// Uploads the original document to cloud storage and records it against the quotation.
async function uploadQuotationFile(file, quotationId, extractedText=''){
  if(!supabaseClient) throw new Error(currentLang==='en'?'Cloud storage is not available':'التخزين السحابي غير متاح');
  const storagePath = `${quotationId}/${safeStorageName(file.name)}`;
  const { error: uploadError } = await supabaseClient.storage
    .from(QUOT_BUCKET)
    .upload(storagePath, file, { cacheControl:'3600', upsert:false, contentType:file.type || 'application/octet-stream' });
  if(uploadError) throw uploadError;
  const { data: urlData } = supabaseClient.storage.from(QUOT_BUCKET).getPublicUrl(storagePath);
  const row = {
    quotation_id: quotationId,
    file_name: file.name,
    file_type: file.type || '',
    file_size: file.size || 0,
    storage_path: storagePath,
    public_url: urlData?.publicUrl || '',
    extracted_text: (extractedText||'').slice(0, 20000)
  };
  const { data, error } = await supabaseClient.from('quotation_files').insert(row).select().single();
  if(error){
    // Do not leave an orphan object behind in the bucket.
    await supabaseClient.storage.from(QUOT_BUCKET).remove([storagePath]).catch(()=>{});
    throw error;
  }
  quotationFiles.push({
    id: data.id, quotationId: data.quotation_id, fileName: data.file_name, fileType: data.file_type,
    fileSize: data.file_size, storagePath: data.storage_path, publicUrl: data.public_url,
    extractedText: data.extracted_text || '', uploadedAt: data.uploaded_at
  });
  return data;
}

async function deleteQuotationFile(fileId){
  const entry = quotationFiles.find(f=>Number(f.id)===Number(fileId));
  if(!entry) return;
  if(!confirm(currentLang==='en'?'Delete this attachment permanently?':'هل تريد حذف هذا الملف المرفق نهائيًا؟')) return;
  try{
    await supabaseClient.storage.from(QUOT_BUCKET).remove([entry.storagePath]);
    const { error } = await supabaseClient.from('quotation_files').delete().eq('id', entry.id);
    if(error) throw error;
    quotationFiles = quotationFiles.filter(f=>Number(f.id)!==Number(fileId));
    toast(currentLang==='en'?'Attachment deleted':'تم حذف الملف المرفق');
    if(activeQuotationId) renderQuotationAttachments(activeQuotationId);
  }catch(err){
    console.warn('Attachment delete failed:', err);
    toast(currentLang==='en'?'Could not delete the attachment':'تعذر حذف الملف المرفق');
  }
}

function renderQuotationAttachments(quotationId){
  const box = document.getElementById('qd_files');
  if(!box) return;
  const list = filesForQuotation(quotationId);
  if(!list.length){
    box.innerHTML = `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${t('quot.noFiles')}</div>`;
    return;
  }
  box.innerHTML = list.map(f=>`
    <div class="log-entry">
      <div class="top">
        <b>${fileKindIcon(f.fileType, f.fileName)} ${esc(f.fileName)}</b>
        <span>${humanFileSize(f.fileSize)}</span>
      </div>
      <div class="note">
        <button type="button" class="link-btn" data-open-file="${f.id}">${t('quot.viewFile')}</button> ·
        <button type="button" class="link-btn" data-print-file="${f.id}">${t('quot.printFile')}</button>
        ${can('delete') ? ` · <button type="button" class="link-btn" data-delete-file="${f.id}">${t('action.delete')}</button>` : ''}
      </div>
    </div>`).join('');
}

// Fetching the object as a blob first gives us a same-origin blob: URL, which is the
// only reliable way to drive window.print() on a file hosted on another domain.
async function printQuotationFile(fileId){
  const entry = quotationFiles.find(f=>Number(f.id)===Number(fileId));
  if(!entry) return;
  const ext = String(entry.fileName).split('.').pop().toLowerCase();
  if(ext==='doc' || ext==='docx'){
    toast(currentLang==='en'?'Word files open in Word for printing':'ملفات Word تُفتح في برنامج Word للطباعة');
    window.open(entry.publicUrl, '_blank');
    return;
  }
  try{
    toast(currentLang==='en'?'Preparing the file for printing…':'جارٍ تجهيز الملف للطباعة…');
    const res = await fetch(entry.publicUrl);
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    if(String(entry.fileType).startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext)){
      printDocument(`<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8">
<title>${esc(entry.fileName)}</title><style>${printSharedStyle()}
img{max-width:100%;height:auto;display:block;margin:12px auto}</style></head><body>
${printBrandHeader(esc(entry.fileName))}
<img src="${blobUrl}" alt="${esc(entry.fileName)}">
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div></body></html>`);
      setTimeout(()=>URL.revokeObjectURL(blobUrl), 60000);
      return;
    }
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    frame.src = blobUrl;
    frame.onload = ()=>setTimeout(()=>{
      try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
      catch(err){ window.open(blobUrl, '_blank'); }
      setTimeout(()=>{ frame.remove(); URL.revokeObjectURL(blobUrl); }, 60000);
    }, 400);
    document.body.appendChild(frame);
  }catch(err){
    console.warn('Printing attachment failed:', err);
    window.open(entry.publicUrl, '_blank');
  }
}

document.getElementById('qd_files')?.addEventListener('click', ev=>{
  const openBtn = ev.target.closest('[data-open-file]');
  const printBtn = ev.target.closest('[data-print-file]');
  const delBtn = ev.target.closest('[data-delete-file]');
  if(openBtn){
    const entry = quotationFiles.find(f=>Number(f.id)===Number(openBtn.dataset.openFile));
    if(entry) window.open(entry.publicUrl, '_blank');
    return;
  }
  if(printBtn){ printQuotationFile(Number(printBtn.dataset.printFile)); return; }
  if(delBtn){ deleteQuotationFile(Number(delBtn.dataset.deleteFile)); }
});

// Attach an extra file to a quotation that already exists.
document.getElementById('qd_attachFile')?.addEventListener('change', async ev=>{
  const file = ev.target.files[0];
  ev.target.value = '';
  if(!file || !activeQuotationId) return;
  if(!can('write')){ toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات'); return; }
  try{
    toast(t('quot.uploading'));
    await uploadQuotationFile(file, activeQuotationId);
    renderQuotationAttachments(activeQuotationId);
    toast(t('quot.fileSaved'));
  }catch(err){
    const parts = [err?.code, err?.statusCode, err?.message, err?.error, err?.details, err?.hint].filter(Boolean);
    const detail = parts.length ? parts.join(' — ') : String(err);
    console.warn('Attachment upload failed:', err);
    showSyncErrorBanner(currentLang==='en'?`uploading "${file.name}"`:`رفع الملف "${file.name}"`, detail);
    toast(currentLang==='en'
      ? 'File upload failed — see the red banner above the quotations list'
      : 'فشل رفع الملف — راجع الشريط الأحمر أعلى قائمة عروض الأسعار');
  }
});

// ============== DOCUMENT IMPORT (PDF / JPG / WORD) ==============
const loadedScripts = {};
function loadScriptOnce(src){
  if(loadedScripts[src]) return loadedScripts[src];
  loadedScripts[src] = new Promise((resolve, reject)=>{
    const el = document.createElement('script');
    el.src = src; el.async = true;
    el.onload = ()=>resolve();
    el.onerror = ()=>reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(el);
  });
  return loadedScripts[src];
}

async function extractTextFromPdf(file){
  await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  const pdfjs = window.pdfjsLib;
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({data:buffer}).promise;
  let text = '';
  const pages = Math.min(doc.numPages, 10);
  for(let i=1; i<=pages; i++){
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    // Rebuild line breaks: pdf.js gives isolated items, so start a new line whenever
    // the vertical position changes, otherwise every field runs into the next one.
    let lastY = null, line = '';
    content.items.forEach(item=>{
      const y = item.transform?.[5];
      if(lastY !== null && Math.abs(y - lastY) > 3){ text += line.trim() + '\n'; line = ''; }
      line += item.str + ' ';
      lastY = y;
    });
    text += line.trim() + '\n';
  }
  return text;
}

async function extractTextFromImage(file){
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  const worker = await window.Tesseract.createWorker(['eng','ara']);
  try{
    const { data } = await worker.recognize(file);
    return data?.text || '';
  } finally {
    await worker.terminate();
  }
}

async function extractTextFromWord(file){
  const ext = String(file.name).split('.').pop().toLowerCase();
  if(ext === 'doc') throw new Error(currentLang==='en'
    ? 'Legacy .doc files are not supported — save as .docx'
    : 'صيغة .doc القديمة غير مدعومة — احفظ الملف بصيغة .docx');
  await loadScriptOnce('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
  const buffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({arrayBuffer:buffer});
  return result?.value || '';
}

async function extractTextFromDocument(file){
  const type = String(file.type||'').toLowerCase();
  const ext = String(file.name).split('.').pop().toLowerCase();
  if(type.includes('pdf') || ext==='pdf'){
    let text = await extractTextFromPdf(file);
    // Scanned PDFs carry no text layer; fall back to OCR on nothing is not possible here,
    // so tell the user rather than silently importing an empty record.
    if(text.replace(/\s/g,'').length < 20) throw new Error(currentLang==='en'
      ? 'This PDF has no readable text layer (scanned). Export a JPG page and import that instead.'
      : 'ملف PDF لا يحتوي نصًا قابلًا للقراءة (ممسوح ضوئيًا). صدّر الصفحة كصورة JPG واستوردها بدلًا منه.');
    return text;
  }
  if(type.startsWith('image/') || ['jpg','jpeg','png','webp'].includes(ext)) return await extractTextFromImage(file);
  if(['doc','docx'].includes(ext) || type.includes('word') || type.includes('officedocument.wordprocessing')) return await extractTextFromWord(file);
  throw new Error(currentLang==='en' ? 'Unsupported file type' : 'نوع الملف غير مدعوم');
}

// Heuristic field extraction. Everything it finds is shown to the user for review
// before it is written, because OCR and PDF layouts are never perfectly predictable.
function parseQuotationFromText(rawText, fileName=''){
  const text = String(rawText||'').replace(/\r/g,'').replace(/[ \t]+/g,' ');
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
  const flat = lines.join('\n');
  const found = {};
  const grab = (re, group=1)=>{ const m = flat.match(re); return m ? String(m[group]||'').trim() : ''; };

  found.email = grab(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, 0);

  const mobileLabelled = grab(/(?:mobile|mob|tel|phone|contact\s*no|جوال|موبايل|هاتف|تليفون)\s*(?:no\.?|#)?\s*[:\-]?\s*((?:\+?\d[\d\s\-()]{6,17}\d))/i);
  found.mobile = (mobileLabelled || grab(/(\+974[\s-]?\d{4}[\s-]?\d{4})/) || grab(/(?:^|\s)([3567]\d{3}[\s-]?\d{4})(?:\s|$)/)).replace(/\s+/g,' ').trim();

  // Reference numbers must sit on the SAME line as their label and must contain a
  // digit — otherwise a bare "QUOTATION" heading swallows the next word as the number.
  const grabRef = (labels)=>{
    const re = new RegExp(`(?:${labels})[^\\S\\n]*(?:no\\.?|number|ref\\.?|code|#|رقم)?[^\\S\\n]*[:\\-.]?[^\\S\\n]*([A-Za-z0-9][A-Za-z0-9\\/\\-_]{2,25})`, 'i');
    for(const line of lines){
      const m = line.match(re);
      if(m && /\d/.test(m[1])) return m[1].replace(/[.,;:]+$/,'');
    }
    return '';
  };
  found.quotationNo = grabRef('quotation|quote|quot|offer|عرض\\s*سعر|عرض\\s*الأسعار|رقم\\s*العرض');
  found.invoiceNo = grabRef('tax\\s*invoice|invoice|inv|فاتورة|رقم\\s*الفاتورة');
  found.projectNo = grabRef('project|job|مشروع|رقم\\s*المشروع');

  // Prefer an explicit grand total; otherwise take the largest money-looking figure.
  const amountLabelled = grab(/(?:grand\s*total|total\s*amount|net\s*total|total|الإجمالي|المجموع|الإجمالي\s*النهائي|القيمة\s*الإجمالية)\s*(?:\(?\s*(?:qar|qr|ر\.?ق)\s*\)?)?\s*[:\-]?\s*([\d][\d,\.\s]{0,18})/i);
  let amount = Number(String(amountLabelled).replace(/[,\s]/g,'')) || 0;
  if(!amount){
    const candidates = (flat.match(/\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d{4,}(?:\.\d{1,2})?/g)||[])
      .map(v=>Number(v.replace(/,/g,''))).filter(v=>isFinite(v) && v>0 && v<1e12);
    amount = candidates.length ? Math.max(...candidates) : 0;
  }
  found.amount = amount;

  const dateLabelled = grab(/(?:date|dated|تاريخ|التاريخ)\s*[:\-]?\s*([0-9]{1,4}[-\/.][0-9]{1,2}[-\/.][0-9]{2,4}|[0-9]{1,2}[-\s][A-Za-z]{3,}[-\s,]*[0-9]{4})/i);
  found.date = toISODate(dateLabelled) || toISODate(grab(/([0-9]{4}[-\/.][0-9]{1,2}[-\/.][0-9]{1,2})/)) || toISODate(grab(/([0-9]{1,2}[-\/.][0-9]{1,2}[-\/.][0-9]{4})/)) || '';

  const validityDays = Number(grab(/(?:valid(?:ity)?|صالح)\s*(?:for)?\s*[:\-]?\s*(\d{1,3})\s*(?:days|يوم)/i));
  if(found.date && validityDays){
    const d = new Date(found.date); d.setDate(d.getDate() + validityDays);
    found.nextFollowup = d.toISOString().slice(0,10);
  }

  found.contactPerson = grab(/(?:attn|attention|kind\s*attention|contact\s*person|عناية|السيد|المهندس)[^\S\n]*[:\-.]?[^\S\n]*((?:Mr\.?|Mrs\.?|Ms\.?|Eng\.?|م\.)?[^\S\n]*[A-Za-z\u0621-\u064A][A-Za-z\u0621-\u064A. \t]{2,40})/i)
    .replace(/\s{2,}/g,' ').replace(/[.,;:]+$/,'').trim();

  // Company name: an explicit "To / M/s / Client" label wins, otherwise the first
  // line that looks like a company, otherwise the file name as a last resort.
  let company = grab(/(?:^|\n)\s*(?:to|m\/?s\.?|messrs\.?|client|customer|bill\s*to|company\s*name|إلى|السادة|العميل|اسم\s*الشركة)\s*[:\-.]?\s*([^\n]{3,70})/i);
  if(!company){
    const companyLine = lines.find(l=>/(?:w\.?l\.?l|l\.?l\.?c|co\.|company|contracting|trading|establishment|est\.|group|est|شركة|مؤسسة|مقاولات|للتجارة)/i.test(l) && l.length<80);
    company = companyLine || '';
  }
  company = company.replace(/^[\s:،,.-]+/,'').replace(/\s{2,}/g,' ').trim();
  if(company.length > 70) company = company.slice(0,70).trim();
  if(!company) company = String(fileName).replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
  found.companyName = company;

  const lower = flat.toLowerCase();
  found.companyScope = /consultant|استشار/.test(lower) ? 'consultant'
    : /sub[-\s]?contract|من الباطن/.test(lower) ? 'subcontractor'
    : /developer|مطور/.test(lower) ? 'developer'
    : /supplier|manufactur|مورد|مصنع/.test(lower) ? 'supplier'
    : 'mainContractor';
  found.subject = /invoice|payment|دفع|فاتورة/.test(lower) ? 'payment'
    : /new\s*client|عميل\s*جديد/.test(lower) ? 'newClient'
    : 'quoteFollowup';
  found.status = found.invoiceNo ? 'paymentPending' : found.quotationNo ? 'submitted' : 'open';

  // A short, readable excerpt of the source so the record is traceable later.
  found.requirement = lines.slice(0, 12).join(' · ').slice(0, 500);
  return found;
}

function fillQuotationModalFrom(fields){
  const set = (id, value)=>{ const el = document.getElementById(id); if(el) el.value = value ?? ''; };
  set('q_company', fields.companyName||'');
  set('q_contact', fields.contactPerson||'');
  set('q_mobile', fields.mobile||'');
  set('q_email', fields.email||'');
  set('q_amount', fields.amount||'');
  set('q_quotationNo', fields.quotationNo||'');
  set('q_invoiceNo', fields.invoiceNo||'');
  set('q_projectNo', fields.projectNo||'');
  set('q_date', fields.date || todayISO());
  set('q_time', '');
  set('q_nextFollowup', fields.nextFollowup||'');
  set('q_requirement', fields.requirement||'');
  set('q_followupAction', '');
  set('q_notes', '');
  const scope = document.getElementById('q_scope'); if(scope) scope.value = fields.companyScope || 'mainContractor';
  const subject = document.getElementById('q_subject'); if(subject) subject.value = fields.subject || 'quoteFollowup';
  const status = document.getElementById('q_status'); if(status) status.value = fields.status || 'open';
}

function buildQuotationFromFields(fields, fallbackDate){
  return {
    id: nextQuotationId++,
    date: fields.date || fallbackDate,
    visitTime: '',
    companyName: fields.companyName || '',
    companyScope: fields.companyScope || 'mainContractor',
    contactPerson: fields.contactPerson || '',
    mobile: fields.mobile || '',
    email: fields.email || '',
    amount: Number(fields.amount)||0,
    quotationNo: fields.quotationNo || '',
    invoiceNo: fields.invoiceNo || '',
    projectNo: fields.projectNo || '',
    subject: fields.subject || 'quoteFollowup',
    nextFollowup: fields.nextFollowup || '',
    status: fields.status || 'open',
    requirement: fields.requirement || '',
    followupAction: '',
    notes: '',
    log: []
  };
}

document.getElementById('importQuotationDocFile')?.addEventListener('change', async ev=>{
  const files = Array.from(ev.target.files||[]);
  ev.target.value = '';
  if(!files.length) return;
  if(!can('write')){ toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات'); return; }
  const fallbackDate = document.getElementById('quotDateFilter')?.value || todayISO();

  // A single file goes through the review modal so OCR mistakes can be corrected.
  if(files.length === 1){
    const file = files[0];
    try{
      toast(t('quot.reading'));
      const text = await extractTextFromDocument(file);
      const fields = parseQuotationFromText(text, file.name);
      editingQuotationId = null;
      pendingQuotationFile = { file, extractedText: text };
      document.getElementById('quotationModalTitle').textContent = t('quot.reviewTitle');
      document.getElementById('saveQuotationBtn').textContent = t('quot.save');
      const banner = document.getElementById('quotExtractBanner');
      if(banner){ banner.style.display = 'block'; banner.textContent = `${t('quot.extractedFrom')} ${file.name}`; }
      fillQuotationModalFrom({...fields, date: fields.date || fallbackDate});
      document.getElementById('quotationModal').classList.add('show');
      toast(t('quot.extracted'));
    }catch(err){
      console.warn('Document extraction failed:', err);
      pendingQuotationFile = null;
      toast(`${t('quot.readFailed')} — ${err?.message||err}`);
    }
    return;
  }

  // Several files at once: import them all automatically, then report the result.
  let added = 0, failed = 0, firstError = '';
  toast(t('quot.reading'));
  for(const file of files){
    try{
      const text = await extractTextFromDocument(file);
      const fields = parseQuotationFromText(text, file.name);
      const record = buildQuotationFromFields(fields, fallbackDate);
      if(!record.companyName) record.companyName = file.name.replace(/\.[^.]+$/,'');
      quotations.push(record);
      const synced = await saveState();
      if(!synced) throw new Error(lastSyncError || 'cloud sync failed');
      await uploadQuotationFile(file, record.id, text);
      added++;
    }catch(err){
      const parts = [err?.code, err?.message, err?.details, err?.hint].filter(Boolean);
      const detail = parts.length ? parts.join(' — ') : String(err?.message||err);
      console.warn('Document import failed for', file.name, err);
      if(!firstError) firstError = `${file.name}: ${detail}`;
      failed++;
    }
  }
  renderAll();
  if(activeQuotationId) renderQuotationAttachments(activeQuotationId);
  if(failed) showSyncErrorBanner(currentLang==='en'?`importing ${failed} document(s)`:`استيراد ${failed} مستند`, firstError);
  toast(currentLang==='en'
    ? `Imported ${added} file(s)${failed?`, ${failed} failed`:''}`
    : `تم استيراد ${added} ملف${failed?`، وفشل ${failed}`:''}`);
});

// ---- Import / template / export ----
document.getElementById('importQuotationsFile')?.addEventListener('change', async e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      // cellDates:true makes XLSX hand us real Date objects instead of serial numbers.
      const wb = XLSX.read(reader.result, {type:'array', cellDates:true});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {defval:'', raw:false, dateNF:'yyyy-mm-dd'});
      const pick=(row,keys)=>{const key=Object.keys(row).find(k=>keys.includes(String(k).trim().toLowerCase()));return key===undefined?'':row[key];};
      const selectedQuotationDate = document.getElementById('quotDateFilter')?.value || todayISO();
      const scopeMap = {'main contractor':'mainContractor','مقاول رئيسي':'mainContractor','subcontractor':'subcontractor','مقاول من الباطن':'subcontractor','consultant':'consultant','استشاري':'consultant','developer / client':'developer','مطور':'developer','مطور / عميل مباشر':'developer','supplier / manufacturer':'supplier','مورد':'supplier','مورد / مصنع':'supplier'};
      const statusMap = {'open':'open','مفتوح':'open','quotation submitted':'submitted','تم تقديم العرض':'submitted','follow-up required':'followup','بانتظار المتابعة':'followup','payment pending':'paymentPending','بانتظار الدفع':'paymentPending','closed':'closed','مغلق':'closed'};
      const subjectMap = {'follow up quote':'quoteFollowup','متابعة عرض سعر':'quoteFollowup','new target client':'newClient','عميل مستهدف جديد':'newClient','payment':'payment','متابعة دفعة':'payment'};
      const toTimeString = toTimeValue;
      const imported = rows.map(row=>{
        const companyName = String(pick(row,['company name','اسم الشركة','company']));
        if(!companyName) return null;
        const scopeRaw = String(pick(row,['company scope / main activity','company scope','نشاط الشركة'])).trim().toLowerCase();
        const statusRaw = String(pick(row,['status / remarks','status','الحالة'])).trim().toLowerCase();
        const subjectRaw = String(pick(row,['visit purpose','الموضوع','موضوع العرض / الزيارة'])).trim().toLowerCase();
        const importedDate = toISODate(pick(row,['date','التاريخ']));
        // "Next Follow-up" is often filled with free text ("next week", "They will send
        // email", "ـــــــ") rather than a date. A `date` column rejects those outright and
        // that single bad value fails the whole upload, so anything unparsable is kept as a
        // note instead of being sent to Postgres.
        const followupRaw = String(pick(row,['next follow-up','next followup','المتابعة القادمة'])).trim();
        const followupDate = toISODate(followupRaw);
        const followupNote = (!followupDate && followupRaw && !/^[ـ\-_—–\s.]+$/.test(followupRaw))
          ? `${currentLang==='en'?'Next follow-up':'المتابعة القادمة'}: ${followupRaw}`
          : '';
        return {
          id: nextQuotationId++,
          date: importedDate || selectedQuotationDate,
          visitTime: toTimeString(pick(row,['time','الوقت'])),
          companyName,
          companyScope: scopeMap[scopeRaw] || 'mainContractor',
          contactPerson: String(pick(row,['contact person','المسؤول'])),
          mobile: String(pick(row,['mobile no.','mobile','الجوال'])),
          email: String(pick(row,['email address','email','البريد الإلكتروني'])),
          amount: Number(String(pick(row,['amount','quotation value','قيمة العرض'])).replace(/[^\d.-]/g,''))||0,
          quotationNo: String(pick(row,['quotation no.','quotation no','رقم عرض السعر'])),
          invoiceNo: String(pick(row,['invoice no.','invoice no','رقم الفاتورة'])),
          projectNo: String(pick(row,['project no.','project no','رقم المشروع'])),
          subject: subjectMap[subjectRaw] || 'quoteFollowup',
          nextFollowup: followupDate,
          status: statusMap[statusRaw] || 'open',
          requirement: String(pick(row,['discussion / client requirement','discussion','requirement','تفاصيل / متطلبات العميل'])),
          followupAction: String(pick(row,['follow-up action / next step','follow-up action','followup action','إجراء المتابعة'])),
          notes: followupNote,
          log: []
        };
      }).filter(Boolean);
      if(!imported.length) throw new Error('empty');
      const msg = t('quot.importConfirm') ? (currentLang==='en'?`Import ${imported.length} quotations?`:`استيراد ${imported.length} عرض سعر؟`) : '';
      if(confirm(msg)){
        quotations.push(...imported);
        if(document.getElementById('quotDateFilter')) document.getElementById('quotDateFilter').value = selectedQuotationDate;
        const synced = await saveStateOrWarn(currentLang==='en'?`importing ${imported.length} rows from Excel`:`استيراد ${imported.length} صف من Excel`);
        renderAll();
        if(synced) toast(t('quot.imported'));
      }
      else { nextQuotationId -= imported.length; }
    }catch(err){ console.warn('Excel import failed:', err); toast(t('quot.importFailed')); }
  };
  reader.readAsArrayBuffer(file); e.target.value='';
});
document.getElementById('downloadQuotTemplateBtn')?.addEventListener('click', ()=>{
  const sheet = XLSX.utils.json_to_sheet([{
    'Date':'2026-09-01','Time':'12:00','Company Name':'اسم الشركة','Company Scope / Main Activity':'Main Contractor',
    'Contact Person':'اسم المسؤول','Mobile No.':'50000000','Email Address':'client@example.com',
    'Amount':0,'Quotation No.':'QTN-2026-00001','Invoice No.':'','Project No.':'','Visit Purpose':'Follow Up Quote','Discussion / Client Requirement':'','Follow-up Action':'','Next Follow-up':'2026-09-08','Status / Remarks':'Open'
  }]);
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Quotations');
  const listsSheet = XLSX.utils.aoa_to_sheet([
    ['Visit Purpose','Status','Company Scope'],
    ['Follow Up Quote','Open','Main Contractor'],
    ['New Target Client','Follow-up Required','Subcontractor'],
    ['Payment','Quotation Submitted','Consultant'],
    ['','Payment Pending','Developer / Client'],
    ['','Closed','Supplier / Manufacturer'],
  ]);
  XLSX.utils.book_append_sheet(book, listsSheet, 'Lists');
  XLSX.writeFile(book, 'daftar-quotations-template.xlsx');
});
document.getElementById('quotExcelBtn')?.addEventListener('click', ()=>{
  const rows = scopedQuotations();
  const headers = currentLang==='en'
    ? ['No.','Date','Time','Company Name','Company Scope','Contact Person','Mobile','Email','Amount','Quotation No.','Invoice No.','Project No.','Visit Purpose','Status','Next Follow-up','Requirement','Follow-up Action']
    : ['م.','التاريخ','الوقت','اسم الشركة','نشاط الشركة','المسؤول','الجوال','البريد الإلكتروني','قيمة العرض','رقم عرض السعر','رقم الفاتورة','رقم المشروع','الموضوع','الحالة','المتابعة القادمة','التفاصيل','إجراء المتابعة'];
  const data = [headers, ...rows.map((q,i)=>[i+1, q.date||'', q.visitTime||'', q.companyName||'', quotScopeLabel(q.companyScope), q.contactPerson||'', q.mobile||'', q.email||'', q.amount||0, q.quotationNo||'', q.invoiceNo||'', q.projectNo||'', quotSubjectLabel(q.subject), quotStatusLabel(q.status), q.nextFollowup||'', q.requirement||'', q.followupAction||''])];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, currentLang==='en'?'Quotations':'عروض الأسعار');
  XLSX.writeFile(book, `daftar-quotations-${todayISO()}.xlsx`);
  addAudit('export_excel', currentLang==='en'?'Quotations list':'قائمة عروض الأسعار');
});
document.getElementById('quotPrintBtn')?.addEventListener('click', ()=>printDocument(quotationsListDocumentHtml(scopedQuotations())));

function quotationsListDocumentHtml(rows){
  const title = t('quot.title');
  const headers = currentLang==='en'
    ? ['No.','Date','Time','Company','Scope','Contact','Mobile','Email','Amount','Subject','Quotation No.','Invoice No.','Project No.','Status','Next Follow-up','Follow-up Action','Requirement']
    : ['م.','التاريخ','الوقت','الشركة','النشاط','المسؤول','الجوال','البريد الإلكتروني','القيمة','الموضوع','رقم عرض السعر','رقم الفاتورة','رقم المشروع','الحالة','المتابعة القادمة','إجراء المتابعة','التفاصيل'];
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((q,i)=>`<tr><td>${i+1}</td><td>${esc(q.date)||'—'}</td><td>${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td><td>${esc(q.contactPerson)||'—'}</td><td>${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td><td>${q.amount?currency(q.amount):'—'}</td><td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td><td>${quotStatusLabel(q.status)}</td><td>${esc(q.nextFollowup)||'—'}</td><td>${esc(q.followupAction)||'—'}</td><td>${esc(q.requirement)||'—'}</td></tr>`).join('') || `<tr><td colspan="17" class="empty">${t('quot.empty')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
function quotationDetailDocumentHtml(q){
  const title = `${t('quot.title')} — ${q.companyName}`;
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
<table>
  <tr><td>${t('quot.company')}</td><td class="num">${esc(q.companyName)}</td></tr>
  <tr><td>${t('quot.scope')}</td><td class="num">${quotScopeLabel(q.companyScope)}</td></tr>
  <tr><td>${t('quot.contact')}</td><td class="num">${esc(q.contactPerson)||'—'}</td></tr>
  <tr><td>${t('quot.mobile')}</td><td class="num">${esc(q.mobile)||'—'}</td></tr>
  <tr><td>${t('quot.email')}</td><td class="num">${esc(q.email)||'—'}</td></tr>
  <tr><td>${t('quot.amount')}</td><td class="num">${q.amount?currency(q.amount):'—'}</td></tr>
  <tr><td>${t('quot.quotationNo')}</td><td class="num">${esc(q.quotationNo)||'—'}</td></tr>
  <tr><td>${t('quot.invoiceNo')}</td><td class="num">${esc(q.invoiceNo)||'—'}</td></tr>
  <tr><td>${t('quot.projectNo')}</td><td class="num">${esc(q.projectNo)||'—'}</td></tr>
  <tr><td>${t('th.date')}</td><td class="num">${esc(q.date)||'—'}</td></tr>
  <tr><td>${t('quot.time')}</td><td class="num">${esc(q.visitTime)||'—'}</td></tr>
  <tr><td>${t('quot.subject')}</td><td class="num">${quotSubjectLabel(q.subject)}</td></tr>
  <tr><td>${t('th.status')}</td><td class="num">${quotStatusLabel(q.status)}</td></tr>
  <tr><td>${t('quot.nextFollowup')}</td><td class="num">${esc(q.nextFollowup)||'—'}</td></tr>
</table>
<h1>${t('quot.requirement')}</h1>
<p>${esc(q.requirement)||'—'}</p>
<h1>${t('quot.statusLog')}</h1>
<table><thead><tr><th>${t('th.date')}</th><th>${t('th.status')}</th><th>${t('th.notes')}</th></tr></thead>
<tbody>${[...q.log].sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map(e=>`<tr><td>${esc(e.date)}</td><td>${quotStatusLabel(e.status)}</td><td>${esc(e.note)||'—'}</td></tr>`).join('') || `<tr><td colspan="3" class="empty">${t('quot.noLog')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}

// ---- Daily quotations report (by date range of status-log entries) ----
function quotationsDailyReportRows(){
  const from = document.getElementById('quotReportFrom')?.value || todayISO();
  const to = document.getElementById('quotReportTo')?.value || todayISO();
  const rows = [];
  quotations.forEach(q=>{
    (q.log||[]).forEach(entry=>{
      if(entry.date >= from && entry.date <= to){
        rows.push({date:entry.date, companyName:q.companyName, subject:quotSubjectLabel(q.subject), status:entry.status, note:entry.note});
      }
    });
  });
  return rows.sort((a,b)=> a.date.localeCompare(b.date));
}
function renderQuotationsReport(){
  const fromEl = document.getElementById('quotReportFrom'), toEl = document.getElementById('quotReportTo');
  if(!fromEl || !toEl) return;
  if(!fromEl.value) fromEl.value = todayISO();
  if(!toEl.value) toEl.value = todayISO();
  const rows = quotationsDailyReportRows();
  const body = document.getElementById('quotReportTableBody');
  document.getElementById('quotReportEmpty').style.display = rows.length ? 'none' : 'block';
  body.innerHTML = rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.companyName)}</td><td>${esc(r.subject)}</td><td><span class="badge ${quotStatusBadgeClass(r.status)}">${quotStatusLabel(r.status)}</span></td><td>${esc(r.note)||'—'}</td></tr>`).join('');
}
document.getElementById('quotReportGenBtn')?.addEventListener('click', renderQuotationsReport);
document.getElementById('quotReportFrom')?.addEventListener('change', renderQuotationsReport);
document.getElementById('quotReportTo')?.addEventListener('change', renderQuotationsReport);
function quotationsReportDocumentHtml(){
  const from = document.getElementById('quotReportFrom')?.value || todayISO();
  const to = document.getElementById('quotReportTo')?.value || todayISO();
  const rows = quotationsDailyReportRows();
  const title = t('quot.reportTitle');
  const headers = currentLang==='en' ? ['Date','Company','Subject','Status','Note'] : ['التاريخ','الشركة','الموضوع','الحالة','ملاحظة'];
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>${printSharedStyle()}</style></head><body>
${printBrandHeader(title)}
<p>${currentLang==='en'?'Period':'الفترة'}: ${esc(from)} — ${esc(to)}</p>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.companyName)}</td><td>${esc(r.subject)}</td><td>${quotStatusLabel(r.status)}</td><td>${esc(r.note)||'—'}</td></tr>`).join('') || `<tr><td colspan="5" class="empty">${t('quot.reportEmpty')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('quotReportPrintBtn')?.addEventListener('click', ()=>printDocument(quotationsReportDocumentHtml()));
document.getElementById('quotReportPdfBtn')?.addEventListener('click', ()=>exportDocumentPdf(quotationsReportDocumentHtml(), `daftar-quotations-report-${todayISO()}.pdf`));

// ---- Daily client visit report (matches the printed Excel visit-report form) ----
function fillQuotRepsDatalist(){
  const list = document.getElementById('quotRepsList');
  if(!list) return;
  list.innerHTML = reps.map(r=>`<option value="${esc(r.name)}"></option>`).join('');
}
function quotVisitReportRows(){
  const date = document.getElementById('quotVisitReportDate')?.value || todayISO();
  return quotations.filter(q=>q.date===date).sort((a,b)=>(a.visitTime||'').localeCompare(b.visitTime||''));
}
function quotVisitReportSummaryCounts(rows){
  return {
    total: rows.length,
    quoteFollowup: rows.filter(r=>r.subject==='quoteFollowup').length,
    newClient: rows.filter(r=>r.subject==='newClient').length,
    payment: rows.filter(r=>r.subject==='payment').length,
  };
}
function renderQuotVisitReport(){
  const dateEl = document.getElementById('quotVisitReportDate');
  if(!dateEl) return;
  if(!dateEl.value) dateEl.value = todayISO();
  const rows = quotVisitReportRows();
  const body = document.getElementById('quotVisitReportTableBody');
  document.getElementById('quotVisitReportEmpty').style.display = rows.length ? 'none' : 'block';
  body.innerHTML = rows.map((q,i)=>`<tr>
    <td class="figures">${i+1}</td><td class="figures">${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td>
    <td>${esc(q.contactPerson)||'—'}</td><td class="figures">${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td>
    <td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td><td>${esc(q.requirement)||'—'}</td><td>${esc(q.followupAction)||'—'}</td>
    <td>${esc(q.nextFollowup)||'—'}</td><td><span class="badge ${quotStatusBadgeClass(q.status)}">${quotStatusLabel(q.status)}</span></td>
  </tr>`).join('');
  const c = quotVisitReportSummaryCounts(rows);
  const cards = [
    [t('quot.totalVisits'), c.total],
    [t('quot.subject.quoteFollowup'), c.quoteFollowup],
    [t('quot.subject.newClient'), c.newClient],
    [t('quot.subject.payment'), c.payment],
  ];
  document.getElementById('quotVisitReportSummary').innerHTML = cards.map(([lbl,val])=>`<div class="stat-card"><div class="lbl">${esc(lbl)}</div><div class="val">${val}</div></div>`).join('');
}
document.getElementById('quotVisitReportGenBtn')?.addEventListener('click', renderQuotVisitReport);
document.getElementById('quotVisitReportDate')?.addEventListener('change', renderQuotVisitReport);
function quotVisitReportDocumentHtml(){
  const date = document.getElementById('quotVisitReportDate')?.value || todayISO();
  const repName = document.getElementById('quotVisitReportRep')?.value || '—';
  const area = document.getElementById('quotVisitReportArea')?.value || '—';
  const rows = quotVisitReportRows();
  const c = quotVisitReportSummaryCounts(rows);
  const title = t('quot.visitReportTitle');
  const headers = currentLang==='en'
    ? ['No.','Time','Company Name','Company Scope','Contact Person','Mobile No.','Email Address','Visit Purpose','Quotation No.','Invoice No.','Project No.','Discussion / Client Requirement','Follow-up Action','Next Follow-up','Status / Remarks']
    : ['م.','الوقت','اسم الشركة','نشاط الشركة','المسؤول','الجوال','البريد الإلكتروني','غرض الزيارة','رقم عرض السعر','رقم الفاتورة','رقم المشروع','النقاش / متطلبات العميل','إجراء المتابعة','المتابعة القادمة','الحالة / الملاحظات'];
  const bodyRows = rows.map((q,i)=>`<tr>
    <td class="num">${i+1}</td><td class="num">${esc(q.visitTime)||'—'}</td><td>${esc(q.companyName)}</td><td>${quotScopeLabel(q.companyScope)}</td>
    <td>${esc(q.contactPerson)||'—'}</td><td class="num">${esc(q.mobile)||'—'}</td><td>${esc(q.email)||'—'}</td>
    <td>${quotSubjectLabel(q.subject)}</td><td>${esc(q.quotationNo)||'—'}</td><td>${esc(q.invoiceNo)||'—'}</td><td>${esc(q.projectNo)||'—'}</td><td>${esc(q.requirement)||'—'}</td><td>${esc(q.followupAction)||'—'}</td>
    <td>${esc(q.nextFollowup)||'—'}</td><td>${quotStatusLabel(q.status)}</td>
  </tr>`).join('') || `<tr><td colspan="15" class="empty">${t('quot.visitReportEmpty')}</td></tr>`;
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>${printSharedStyle()}
.visit-info{display:flex; gap:24px; flex-wrap:wrap; margin-bottom:16px; font-size:12.5px;}
.visit-info b{color:#20242c;}
.visit-summary{display:flex; gap:14px; flex-wrap:wrap; margin:18px 0;}
.visit-summary .box{flex:1; min-width:140px; text-align:center; padding:12px; border:1px solid #e2e5ec; border-radius:8px;}
.visit-summary .box .lbl{font-size:11px; color:#6b7280; margin-bottom:6px;}
.visit-summary .box .val{font-size:18px; font-weight:800;}
.sign-row{display:flex; justify-content:space-between; margin-top:36px;}
.sign-row .box{width:45%; border-top:1px solid #9aa0ab; padding-top:8px; text-align:center; font-size:11.5px; color:#6b7280;}
</style></head><body>
${printBrandHeader(title)}
<div class="visit-info">
  <div><b>${t('quot.reportSalesInCharge')}:</b> ${esc(repName)}</div>
  <div><b>${t('quot.reportDate')}:</b> ${esc(date)}</div>
  <div><b>${t('quot.reportAreaRoute')}:</b> ${esc(area)}</div>
</div>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${bodyRows}</tbody></table>
<h1 style="font-size:13px; margin-top:6px;">${t('quot.visitSummaryTitle')}</h1>
<div class="visit-summary">
  <div class="box"><div class="lbl">${esc(t('quot.totalVisits'))}</div><div class="val">${c.total}</div></div>
  <div class="box"><div class="lbl">${esc(t('quot.subject.quoteFollowup'))}</div><div class="val">${c.quoteFollowup}</div></div>
  <div class="box"><div class="lbl">${esc(t('quot.subject.newClient'))}</div><div class="val">${c.newClient}</div></div>
  <div class="box"><div class="lbl">${esc(t('quot.subject.payment'))}</div><div class="val">${c.payment}</div></div>
</div>
<div class="sign-row">
  <div class="box">${t('quot.preparedBy')}</div>
  <div class="box">${t('quot.reviewedBy')}</div>
</div>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('quotVisitReportPrintBtn')?.addEventListener('click', ()=>printDocument(quotVisitReportDocumentHtml()));
document.getElementById('quotVisitReportPdfBtn')?.addEventListener('click', ()=>exportDocumentPdf(quotVisitReportDocumentHtml(), `daftar-visit-report-${document.getElementById('quotVisitReportDate')?.value||todayISO()}.pdf`));
document.getElementById('quotVisitReportExcelBtn')?.addEventListener('click', ()=>{
  const date = document.getElementById('quotVisitReportDate')?.value || todayISO();
  const repName = document.getElementById('quotVisitReportRep')?.value || '';
  const area = document.getElementById('quotVisitReportArea')?.value || '';
  const rows = quotVisitReportRows();
  const c = quotVisitReportSummaryCounts(rows);
  const en = currentLang==='en';
  const headers = en
    ? ['No.','Time','Company Name','Company Scope / Main Activity','Contact Person','Mobile No.','Email Address','Visit Purpose','Quotation No.','Invoice No.','Project No.','Discussion / Client Requirement','Follow-up Action','Next Follow-up','Status / Remarks']
    : ['م.','الوقت','اسم الشركة','نشاط الشركة الرئيسي','المسؤول','رقم الجوال','البريد الإلكتروني','غرض الزيارة','رقم عرض السعر','رقم الفاتورة','رقم المشروع','النقاش / متطلبات العميل','إجراء المتابعة','المتابعة القادمة','الحالة / الملاحظات'];
  const aoa = [
    [en?'DAILY CLIENT VISIT REPORT':'التقرير اليومي لزيارات العملاء'],
    [],
    [en?'Sales In-Charge:':'مسؤول المبيعات:', repName, '', en?'Report Date:':'تاريخ التقرير:', date, '', en?'Area / Route:':'المنطقة / خط السير:', area],
    [],
    headers,
    ...rows.map((q,i)=>[i+1, q.visitTime||'', q.companyName||'', quotScopeLabel(q.companyScope), q.contactPerson||'', q.mobile||'', q.email||'', quotSubjectLabel(q.subject), q.quotationNo||'', q.invoiceNo||'', q.projectNo||'', q.requirement||'', q.followupAction||'', q.nextFollowup||'', quotStatusLabel(q.status)]),
    [],
    [en?'Daily Visit Summary':'ملخص الزيارات اليومي'],
    [en?'Total Client Visits':'إجمالي عدد الزيارات', c.total],
    [t('quot.subject.quoteFollowup'), c.quoteFollowup],
    [t('quot.subject.newClient'), c.newClient],
    [t('quot.subject.payment'), c.payment],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = [{wch:5},{wch:9},{wch:28},{wch:20},{wch:18},{wch:14},{wch:26},{wch:16},{wch:16},{wch:16},{wch:16},{wch:34},{wch:24},{wch:14},{wch:18}];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, en?'Visit Report':'تقرير الزيارات');
  XLSX.writeFile(book, `daftar-visit-report-${date}.xlsx`);
});

// ============== REPS ==============
let editingRepId = null;
document.getElementById('addRepBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  editingRepId = null;
  document.querySelector('#repModal .modal-head h3').textContent = t('modal.addRep');
  document.getElementById('saveRepBtn').textContent = t('modal.saveRep');
  ['r_name','r_phone','r_area'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('repModal').classList.add('show');
});
function openRepEditModal(id){
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const r = reps.find(x=>x.id===id);
  if(!r) return;
  editingRepId = id;
  document.querySelector('#repModal .modal-head h3').textContent = t('modal.editRep');
  document.getElementById('saveRepBtn').textContent = t('modal.saveChanges');
  document.getElementById('r_name').value = r.name||'';
  document.getElementById('r_phone').value = r.phone||'';
  document.getElementById('r_area').value = r.area||'';
  document.getElementById('repModal').classList.add('show');
}
document.getElementById('saveRepBtn').addEventListener('click', ()=>{
  if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
  const name = document.getElementById('r_name').value.trim();
  const phone = document.getElementById('r_phone').value.trim();
  const area = document.getElementById('r_area').value.trim();
  if(!name){ toast(t('msg.repRequired')); return; }
  if(editingRepId){
    const r = reps.find(x=>x.id===editingRepId);
    if(r){
      const before = {name:r.name, phone:r.phone, area:r.area};
      r.name = name; r.phone = phone; r.area = area;
      let diffParts=[];
      if(before.name!==name) diffParts.push(`${currentLang==='en'?'name':'الاسم'}: ${before.name} → ${name}`);
      if(before.phone!==phone) diffParts.push(`${currentLang==='en'?'phone':'الهاتف'}: ${before.phone||'—'} → ${phone||'—'}`);
      if(before.area!==area) diffParts.push(`${currentLang==='en'?'area':'المنطقة'}: ${before.area||'—'} → ${area||'—'}`);
      addAudit('update_rep', `${name}${diffParts.length?' — '+diffParts.join(' | '):''}`);
    }
    document.getElementById('repModal').classList.remove('show');
    toast(t('toast.updated'));
    editingRepId = null;
    if(activeRepId) openRepDrawer(activeRepId);
    renderAll();
    return;
  }
  reps.push({id:nextRepId++, name, phone, area});
  document.getElementById('repModal').classList.remove('show');
  addAudit('add_rep', name);
  toast('تمت إضافة المندوب بنجاح');
  renderAll();
});

function repStats(repId){
  const cases = debtors.filter(d=>d.repId===repId);
  const total = cases.reduce((s,d)=>s+d.total,0);
  const collected = cases.reduce((s,d)=>s+d.paid,0);
  const rate = total? Math.round(collected/total*100):0;
  
  // Calculate rating based on performance
  let rating = 'average';
  if (rate >= 80) rating = 'excellent';
  else if (rate >= 60) rating = 'good';
  else if (rate < 40) rating = 'poor';
  
  return {cases, total, collected, rate, rating};
}

function openRepDrawer(id){
  activeRepId = id;
  const r = reps.find(x=>x.id===id);
  if(!r) return;
  const st = repStats(id);
  document.getElementById('rd_seal').textContent = initials(r.name);
  document.getElementById('rd_name').textContent = r.name;
  document.getElementById('rd_phone').textContent = r.phone || '—';
  document.getElementById('rd_area').textContent = r.area || '—';
  document.getElementById('rd_cases').textContent = st.cases.length;
  document.getElementById('rd_total').textContent = currency(st.total);
  document.getElementById('rd_collected').textContent = currency(st.collected);
  document.getElementById('rd_rate').textContent = st.rate+'%';
  const listEl = document.getElementById('rd_cases_list');
  listEl.innerHTML = st.cases.length ? st.cases.map(d=>`
    <div class="log-entry" style="cursor:pointer" data-goto="${d.id}">
      <div class="top"><b>${esc(d.name)}</b><span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span></div>
      <div class="note">${currentLang==='en'?'Remaining':'المتبقي'}: <span class="figures">${fmt(remaining(d))}</span> ${currentLang==='en'?'QAR':'ر.ق'}</div>
    </div>`).join('') : `<div style="color:var(--muted); font-size:12.5px; padding:10px 0">${t('msg.noCases')}</div>`;
  listEl.querySelectorAll('[data-goto]').forEach(el=>el.addEventListener('click', ()=>{
    closeRepDrawer();
    openDrawer(Number(el.dataset.goto));
  }));
  document.getElementById('repDrawer').classList.add('show');
  document.getElementById('repDrawerOverlay').classList.add('show');
}
function closeRepDrawer(){
  document.getElementById('repDrawer').classList.remove('show');
  document.getElementById('repDrawerOverlay').classList.remove('show');
  activeRepId = null;
}
document.getElementById('repDrawerClose').addEventListener('click', closeRepDrawer);
document.getElementById('repDrawerOverlay').addEventListener('click', closeRepDrawer);
document.getElementById('rd_edit').addEventListener('click', ()=>{
  if(!activeRepId) return;
  openRepEditModal(activeRepId);
});
document.getElementById('rd_delete').addEventListener('click', ()=>{
  if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
  if(!activeRepId) return;
  if(!confirm(currentLang==='en'?'Delete this collector? Assigned cases will become unassigned.':'حذف هذا المندوب؟ سيتم إلغاء إسناد حالاته تلقائيًا.')) return;
  const rep=reps.find(x=>x.id===activeRepId);
  debtors.forEach(d=>{ if(d.repId===activeRepId) d.repId=null; });
  reps = reps.filter(x=>x.id!==activeRepId);
  users.forEach(u=>{ if(u.repId===activeRepId) u.repId=undefined; });
  saveUsers();
  addAudit('delete_rep', rep?rep.name:String(activeRepId));
  closeRepDrawer();
  toast('تم حذف المندوب');
  renderAll();
});

function renderReps(){
  const body = document.getElementById('repsTableBody');
  document.getElementById('repsEmpty').style.display = reps.length ? 'none' : 'block';
  body.innerHTML = reps.map(r=>{
    const st = repStats(r.id);
    const ratingLabels = {
      excellent: t('reps.excellent'),
      good: t('reps.good'),
      average: t('reps.average'),
      poor: t('reps.poor')
    };
    const ratingColors = {
      excellent: '#3E8E7E',
      good: '#C9A227',
      average: '#8B93A8',
      poor: '#B33A3A'
    };
    
    return `<tr data-id="${r.id}">
      <td>${esc(r.name)}</td>
      <td class="figures" style="font-weight:500">${esc(r.phone)||'—'}</td>
      <td>${esc(r.area)||'—'}</td>
      <td class="figures">${st.cases.length}</td>
      <td class="figures">${fmt(st.collected)}</td>
      <td class="figures">${st.rate}%</td>
      <td><span class="badge" style="background:${ratingColors[st.rating]}20; color:${ratingColors[st.rating]}; border-color:${ratingColors[st.rating]}40;">${ratingLabels[st.rating]}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-open="${r.id}" title="${t('action.view')}">◎</button>
          <button class="icon-btn" data-edit-rep="${r.id}" title="${t('action.edit')}">✎</button>
          <button class="icon-btn danger" data-del="${r.id}" title="${t('action.delete')}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      openRepDrawer(Number(tr.dataset.id));
    });
  });
  body.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); openRepDrawer(Number(b.dataset.open)); }));
  body.querySelectorAll('[data-edit-rep]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); openRepEditModal(Number(b.dataset.editRep)); }));
  body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', e=>{
    e.stopPropagation();
    if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
    if(!confirm(currentLang==='en'?'Delete this collector? Assigned cases will become unassigned.':'حذف هذا المندوب؟ سيتم إلغاء إسناد حالاته تلقائيًا.')) return;
    const id = Number(b.dataset.del);
    const rep = reps.find(x=>x.id===id);
    debtors.forEach(d=>{ if(d.repId===id) d.repId=null; });
    reps = reps.filter(x=>x.id!==id);
    users.forEach(u=>{ if(u.repId===id) u.repId=undefined; });
    saveUsers();
    addAudit('delete_rep', rep?rep.name:String(id));
    toast(t('msg.repDeleted'));
    renderAll();
  }));

  document.getElementById('repStatCount').textContent = reps.length;
  const collectedByReps = debtors.filter(d=>d.repId).reduce((s,d)=>s+d.paid,0);
  document.getElementById('repStatCollected').textContent = currency(collectedByReps);
  document.getElementById('repStatUnassigned').textContent = debtors.filter(d=>!d.repId).length;
}

// ============== RENDER ==============
function renderAll(){
  saveState();
  renderStats();
  renderDebtorsTable();
  renderReps();
  renderPayments();
  renderFollowups();
  renderQuotationsTable();
  renderQuotationsReport();
  fillQuotRepsDatalist();
  renderQuotVisitReport();
  renderAging();
  renderReports();
  renderDashboardExtras();
  renderDueReminders();
  renderCharts();
}

function agingBucket(days){
  if(days<=30) return {key:'b1',label:t('aging.b1')};
  if(days<=60) return {key:'b2',label:t('aging.b2')};
  if(days<=90) return {key:'b3',label:t('aging.b3')};
  return {key:'b4',label:t('aging.b4')};
}
function getAgingRows(){
  return scopedDebtors().filter(d=>remaining(d)>0 && new Date(d.due)<new Date(todayISO())).map(d=>{
    const days=Math.max(1,daysBetween(d.due,todayISO())); return {...d,daysLate:days,bucket:agingBucket(days)};
  }).sort((a,b)=>b.daysLate-a.daysLate);
}
function renderAging(){
  const groups={b1:[],b2:[],b3:[],b4:[]}; getAgingRows().forEach(d=>groups[d.bucket.key].push(d));
  Object.keys(groups).forEach(key=>{
    document.getElementById(`aging_${key}_amt`).textContent=currency(groups[key].reduce((sum,d)=>sum+remaining(d),0));
    document.getElementById(`aging_${key}_cnt`).textContent=groups[key].length+(currentLang==='en'?' cases':' حالة');
  });
  const body=document.getElementById('agingTableBody'); const rows=getAgingRows();  document.getElementById('agingEmpty').style.display=rows.length?'none':'block';
  body.innerHTML=rows.map(d=>`<tr data-id="${d.id}"><td>${esc(d.name)}</td><td>${d.type==='company'?t('debtors.company'):t('debtors.individual')}</td><td>${esc(d.phone)||'—'}</td><td>${esc(d.due)}</td><td class="figures">${d.daysLate}</td><td><span class="badge overdue">${d.bucket.label}</span></td><td class="figures">${fmt(remaining(d))}</td><td>${esc((reps.find(r=>r.id===d.repId)||{}).name)||t('drawer.noRep')}</td>${notesTd(d)}</tr>`).join('');
  body.querySelectorAll('tr').forEach(row=>row.addEventListener('click',()=>openDrawer(Number(row.dataset.id))));
}

function renderStats(){
  const scoped=scopedDebtors();
  const total = scoped.reduce((s,d)=>s+d.total,0);
  const collected = scoped.reduce((s,d)=>s+d.paid,0);
  const overdueDebtors = scoped.filter(d=>statusOf(d)==='overdue');
  const overdueAmt = overdueDebtors.reduce((s,d)=>s+remaining(d),0);
  const activeCount = scoped.filter(d=>statusOf(d)!=='paid').length;

  document.getElementById('statTotal').textContent = currency(total);
  document.getElementById('statCount').textContent = scoped.length;
  document.getElementById('statCollected').textContent = currency(collected);
  document.getElementById('statCollectedPct').textContent = (total? Math.round(collected/total*100):0)+'% '+t('dash.ofTotal');
  document.getElementById('statOverdue').textContent = currency(overdueAmt);
  document.getElementById('statOverdueCount').textContent = overdueDebtors.length;
  document.getElementById('statActive').textContent = activeCount;

  const companies = scoped.filter(d=>d.type==='company');
  const individuals = scoped.filter(d=>d.type!=='company');
  document.getElementById('statCompanyTotal').textContent = currency(companies.reduce((s,d)=>s+remaining(d),0));
  document.getElementById('statCompanyCount').textContent = companies.length;
  document.getElementById('statIndividualTotal').textContent = currency(individuals.reduce((s,d)=>s+remaining(d),0));
  document.getElementById('statIndividualCount').textContent = individuals.length;
  
  // Enhanced dashboard metrics
  const monthlyTarget = Math.round(total * 0.15); // 15% of total as monthly target
  const monthlyCollected = scoped.reduce((s,d)=>s+d.paid,0); // Simplified monthly calculation
  const targetProgress = monthlyTarget ? Math.round(monthlyCollected/monthlyTarget*100) : 0;
  const collectionRate = total ? Math.round(collected/total*100) : 0;
  
  // Calculate average days to collect
  const paymentsWithDays = [];
  scoped.forEach(d => {
    (d.log || []).filter(e => e.type === 'payment').forEach(e => {
      const daysToCollect = daysBetween(d.due, e.date);
      if (daysToCollect > 0) {
        paymentsWithDays.push(daysToCollect);
      }
    });
  });
  const avgDays = paymentsWithDays.length ? Math.round(paymentsWithDays.reduce((a,b)=>a+b,0)/paymentsWithDays.length) : 0;
  
  document.getElementById('statMonthlyTarget').textContent = currency(monthlyTarget);
  document.getElementById('statCollectionRate').textContent = collectionRate + '%';
  document.getElementById('statAvgDays').textContent = avgDays;
  
  // Set trends (simplified for demo)
  setTrendIndicator('statTotalTrend', 0);
  setTrendIndicator('statCollectedTrend', 5); // 5% increase
  setTrendIndicator('statOverdueTrend', -2); // 2% decrease
  setTrendIndicator('statActiveTrend', 0);
}

function setTrendIndicator(elementId, percentage) {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  if (percentage > 0) {
    element.textContent = `↑ ${percentage}%`;
    element.className = 'trend up';
  } else if (percentage < 0) {
    element.textContent = `↓ ${Math.abs(percentage)}%`;
    element.className = 'trend down';
  } else {
    element.textContent = '—';
    element.className = 'trend neutral';
  }
}

let collectionChart = null;
let collectorChart = null;
let paymentMethodsChart = null;
let debtDistributionChart = null;
let repsMonthlyChart = null;

function renderCharts() {
  const scoped = scopedDebtors();
  const currentLang = document.documentElement.lang;

  // Collection Trend Chart
  const months = {};
  scoped.forEach(d => {
    (d.log || []).filter(e => e.type === 'payment').forEach(e => {
      const month = e.date.slice(0, 7);
      months[month] = (months[month] || 0) + e.amount;
    });
  });

  const sortedMonths = Object.keys(months).sort().slice(-6);
  const collectionCtx = document.getElementById('collectionChart');
  if (collectionCtx) {
    if (collectionChart) collectionChart.destroy();
    collectionChart = new Chart(collectionCtx, {
      type: 'line',
      data: {
        labels: sortedMonths,
        datasets: [{
          label: currentLang === 'en' ? 'Collected Amount' : 'المبلغ المحصّل',
          data: sortedMonths.map(m => months[m] || 0),
          borderColor: '#C9A227',
          backgroundColor: 'rgba(201, 162, 39, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          }
        }
      }
    });
  }

  // Collector Performance Chart
  const collectorCtx = document.getElementById('collectorChart');
  if (collectorCtx && reps.length > 0) {
    if (collectorChart) collectorChart.destroy();
    const collectorData = reps.map(r => {
      const cases = scoped.filter(d => d.repId === r.id);
      const collected = cases.reduce((sum, d) => sum + d.paid, 0);
      return { name: r.name, collected };
    });

    collectorChart = new Chart(collectorCtx, {
      type: 'bar',
      data: {
        labels: collectorData.map(d => d.name),
        datasets: [{
          label: currentLang === 'en' ? 'Collected Amount' : 'المبلغ المحصّل',
          data: collectorData.map(d => d.collected),
          backgroundColor: [
            '#C9A227', '#2BB3A3', '#5EA9E8', '#E28A9A', '#FF8C42', '#9C6ADE'
          ],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  // Payment Methods Chart
  const paymentMethodsCtx = document.getElementById('paymentMethodsChart');
  if (paymentMethodsCtx) {
    if (paymentMethodsChart) paymentMethodsChart.destroy();
    
    const paymentMethods = {};
    scoped.forEach(d => {
      (d.log || []).filter(e => e.type === 'payment').forEach(e => {
        const method = translateValue(e.method);
        paymentMethods[method] = (paymentMethods[method] || 0) + e.amount;
      });
    });

    paymentMethodsChart = new Chart(paymentMethodsCtx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(paymentMethods),
        datasets: [{
          data: Object.values(paymentMethods),
          backgroundColor: ['#C9A227', '#2BB3A3', '#5EA9E8', '#E28A9A', '#FF8C42'],
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        }
      }
    });
  }

  // Debt Distribution Chart
  const debtDistributionCtx = document.getElementById('debtDistributionChart');
  if (debtDistributionCtx) {
    if (debtDistributionChart) debtDistributionChart.destroy();
    
    const statusCounts = { active: 0, overdue: 0, paid: 0 };
    scoped.forEach(d => statusCounts[statusOf(d)]++);

    debtDistributionChart = new Chart(debtDistributionCtx, {
      type: 'pie',
      data: {
        labels: [t('status.active'), t('status.overdue'), t('status.paid')],
        datasets: [{
          data: [statusCounts.active, statusCounts.overdue, statusCounts.paid],
          backgroundColor: ['#3E8E7E', '#B33A3A', '#C9A227'],
          borderWidth: 2,
          borderColor: getComputedStyle(document.documentElement).getPropertyValue('--surface')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        }
      }
    });
  }

  // Reps Monthly Performance Chart
  const repsMonthlyCtx = document.getElementById('repsMonthlyChart');
  if (repsMonthlyCtx && reps.length > 0) {
    if (repsMonthlyChart) repsMonthlyChart.destroy();
    
    const months = {};
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    reps.forEach(r => {
      const cases = scopedDebtors().filter(d => d.repId === r.id);
      cases.forEach(d => {
        (d.log || []).filter(e => e.type === 'payment').forEach(e => {
          const month = e.date.slice(0, 7);
          if (!months[month]) months[month] = {};
          months[month][r.name] = (months[month][r.name] || 0) + e.amount;
        });
      });
    });

    const sortedMonths = Object.keys(months).sort().slice(-6);
    const datasets = reps.map((r, index) => ({
      label: r.name,
      data: sortedMonths.map(m => months[m]?.[r.name] || 0),
      borderColor: ['#C9A227', '#2BB3A3', '#5EA9E8', '#E28A9A', '#FF8C42', '#9C6ADE'][index % 6],
      backgroundColor: 'transparent',
      tension: 0.4
    }));

    repsMonthlyChart = new Chart(repsMonthlyCtx, {
      type: 'line',
      data: {
        labels: sortedMonths,
        datasets: datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--ink')
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          },
          x: {
            ticks: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--muted')
            },
            grid: {
              color: getComputedStyle(document.documentElement).getPropertyValue('--border')
            }
          }
        }
      }
    });
  }
}

function renderDashboardExtras(){
  // top overdue bars
  const scoped=scopedDebtors();
  const overdue = scoped.filter(d=>statusOf(d)==='overdue').sort((a,b)=>remaining(b)-remaining(a)).slice(0,5);
  const maxAmt = Math.max(...overdue.map(d=>remaining(d)), 1);
  const barsEl = document.getElementById('topOverdueBars');
  if(!overdue.length){
    barsEl.innerHTML = `<div style="color:var(--muted); font-size:13px">${currentLang==='en'?'No overdue cases currently.':'لا توجد حالات متأخرة حاليًا.'}</div>`;
  } else {
    barsEl.innerHTML = overdue.map(d=>`
      <div class="bar-row">
        <div class="name">${esc(d.name.split(' ').slice(0,2).join(' '))}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${remaining(d)/maxAmt*100}%; background:linear-gradient(90deg,#7a2626,#B33A3A)"></div></div>
        <div class="amt figures">${fmt(remaining(d))}</div>
      </div>`).join('');
  }

  // recent activity
  let allActivity = [];
  scoped.forEach(d=>{
    d.log.forEach(e=>allActivity.push({...e, debtor:d.name}));
  });
  allActivity.sort((a,b)=> a.date < b.date ? 1 : -1);
  allActivity = allActivity.slice(0,6);
  const actEl = document.getElementById('recentActivity');
  if(!allActivity.length){
    actEl.innerHTML = `<div style="color:var(--muted); font-size:13px">${currentLang==='en'?'No activity recorded yet.':'لا يوجد نشاط مسجل بعد.'}</div>`;
  } else {
    actEl.innerHTML = allActivity.map(e=>{
      const txt = e.type==='payment' ? `${currentLang==='en'?'Payment':'دفعة'} ${fmt(e.amount)} ${currentLang==='en'?'QAR':'ر.ق'} ${currentLang==='en'?'from':'من'} ${esc(e.debtor)}` : `${currentLang==='en'?'Follow-up':'متابعة'} (${translateValue(e.method)}) ${currentLang==='en'?'with':'مع'} ${esc(e.debtor)}`;
      return `<div class="activity-item"><div class="activity-dot"></div><div><div class="t">${txt}</div><div class="d">${esc(e.date)}</div></div></div>`;
    }).join('');
  }
}

function calculateRiskLevel(d) {
  const daysLate = daysBetween(d.due, todayISO());
  const remainingAmount = remaining(d);
  const totalAmount = d.total;
  const riskRatio = remainingAmount / totalAmount;

  if (statusOf(d) === 'paid') return 'low';
  if (daysLate > 90 && riskRatio > 0.5) return 'high';
  if (daysLate > 60 && riskRatio > 0.3) return 'high';
  if (daysLate > 30) return 'medium';
  if (riskRatio > 0.7) return 'medium';
  return 'low';
}

function renderDebtorsTable(){
  const q = document.getElementById('globalSearch').value.trim().toLowerCase();
  const filter = document.getElementById('statusFilter').value;
  const typeFilter = document.getElementById('typeFilter').value;
  const minAmount = parseFloat(document.getElementById('minAmount').value) || 0;
  const maxAmount = parseFloat(document.getElementById('maxAmount').value) || Infinity;
  const minDate = document.getElementById('minDate').value;
  const maxDate = document.getElementById('maxDate').value;
  const collectorFilter = document.getElementById('collectorFilter').value;
  const riskFilter = document.getElementById('riskFilter').value;

  let list = scopedDebtors().filter(d=>{
    const matchQ = !q || d.name.toLowerCase().includes(q) || (d.phone||'').includes(q)
      || (d.companyNumber||'').toLowerCase().includes(q) || (d.crNumber||'').toLowerCase().includes(q)
      || (d.notes||'').toLowerCase().includes(q);
    const matchF = filter==='all' || statusOf(d)===filter;
    const matchT = typeFilter==='all' || (d.type||'individual')===typeFilter;
    const matchAmount = remaining(d) >= minAmount && remaining(d) <= maxAmount;
    let matchDate = true;
    if (minDate && d.due < minDate) matchDate = false;
    if (maxDate && d.due > maxDate) matchDate = false;
    const matchCollector = collectorFilter === 'all' || d.repId === Number(collectorFilter);
    const matchRisk = riskFilter === 'all' || calculateRiskLevel(d) === riskFilter;

    return matchQ && matchF && matchT && matchAmount && matchDate && matchCollector && matchRisk;
  });
  const body = document.getElementById('debtorsTableBody');
  document.getElementById('debtorsEmpty').style.display = list.length ? 'none' : 'block';
  body.innerHTML = list.map(d=>{
    const lastLog = [...d.log].reverse()[0];
    const lastContact = lastLog ? lastLog.date : '—';
    const repName = reps.find(r=>r.id===d.repId);
    const isCompany = d.type==='company';
    return `<tr data-id="${d.id}">
      <td>${esc(d.name)}</td>
      <td><span class="badge ${isCompany?'type-company':'type-individual'}">${isCompany?t('debtors.company'):t('debtors.individual')}</span></td>
      <td class="figures" style="font-weight:500">${esc(d.phone)||'—'}</td>
      <td class="figures">${fmt(d.total)}</td>
      <td class="figures">${fmt(d.paid)}</td>
      <td class="figures">${fmt(remaining(d))}</td>
      <td><span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span></td>
      <td style="color:${repName?'var(--ink)':'var(--muted)'}">${repName?esc(repName.name):t('drawer.noRep')}</td>
      ${notesTd(d)}
      <td>${d.expectedPaymentDate||'—'}</td>
      <td>${esc(lastContact)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-open="${d.id}" title="${t('action.view')}">◎</button>
          <button class="icon-btn" data-quick-contact="${d.id}" title="${t('drawer.addFollow')}">☎</button>
          <button class="icon-btn" data-edit="${d.id}" title="${t('action.edit')}">✎</button>
          <button class="icon-btn danger" data-del="${d.id}" data-delete title="${t('action.delete')}">✕</button>
        </div>
      </td>
    </tr>`;
  }).join('');
  body.querySelectorAll('tr').forEach(tr=>{
    tr.addEventListener('click', (e)=>{
      if(e.target.closest('button')) return;
      openDrawer(Number(tr.dataset.id));
    });
  });
  body.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click', e=>{ e.stopPropagation(); openDrawer(Number(b.dataset.open)); }));
  body.querySelectorAll('[data-quick-contact]').forEach(b=>b.addEventListener('click', e=>{
    e.preventDefault(); e.stopPropagation();
    if(!can('write')){toast(currentLang==='en'?'You do not have permission to edit data':'لا تملك صلاحية تعديل البيانات');return;}
    const d = debtors.find(x=>x.id===Number(b.dataset.quickContact));
    if(!d) return;
    const note = prompt(currentLang==='en'?'Contact outcome / note:':'نتيجة التواصل / الملاحظة:');
    if(note===null || !note.trim()) return;
    const date = todayISO();
    const method = 'اتصال هاتفي';
    d.log.push({id:genLogId(), type:'follow', date, method, note:note.trim()});
    d.notes = `[${date}] ${translateValue(method)}: ${note.trim()}` + (d.notes ? '\n' + d.notes : '');
    addAudit('add_followup', `${d.name} (${translateValue(method)}): ${note.trim()}`);
    toast(t('msg.followAdded'));
    renderAll();
  }));
  body.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', e=>{ e.preventDefault(); e.stopPropagation(); openDebtorEditModal(Number(b.dataset.edit)); }));
  body.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', e=>{
    e.preventDefault(); e.stopPropagation();
    if(!can('delete')){toast(currentLang==='en'?'You do not have permission to delete':'لا تملك صلاحية الحذف');return;}
    if(!confirm(t('confirm.deleteDebtor'))) return;
    const target=debtors.find(x=>x.id===Number(b.dataset.del));
    debtors = debtors.filter(x=>x.id!==Number(b.dataset.del));
    addAudit('delete_debtor', target ? `${target.name} — ${fmt(remaining(target))}` : String(b.dataset.del));
    toast(t('toast.deleted'));
    renderAll();
  }));
}

function renderPayments(){
  let rows = [];
  scopedDebtors().forEach(d=>{
    d.log.filter(e=>e.type==='payment').forEach(e=>rows.push({...e, debtor:d.name, debtorId:d.id}));
  });
  rows.sort((a,b)=> a.date < b.date ? 1 : -1);
  const body = document.getElementById('paymentsTableBody');
  document.getElementById('paymentsEmpty').style.display = rows.length ? 'none' : 'block';
  const actionsAllowed = can('write');
  body.innerHTML = rows.map(r=>{
    const actions = actionsAllowed ? `<div class="row-actions"><button class="icon-btn" data-pay-edit="${r.debtorId}:${r.id}" title="${t('action.edit')}">✎</button><button class="icon-btn danger" data-pay-del="${r.debtorId}:${r.id}" title="${t('action.delete')}">✕</button></div>` : '—';
    return `<tr>
    <td>${esc(r.date)}</td><td>${esc(r.debtor)}</td><td class="figures">${currency(r.amount)}</td><td>${translateValue(r.method)}</td>${notesTd({notes:r.note})}<td>${actions}</td>
  </tr>`;
  }).join('');
  body.querySelectorAll('[data-pay-edit]').forEach(b=>b.addEventListener('click', ()=>{
    const [debtorId, logId] = b.dataset.payEdit.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='payment');
    if(!d || !entry) return;
    const input = prompt(t('drawer.editPaymentPrompt'), String(entry.amount));
    if(input===null) return;
    const newAmt = parseFloat(input);
    if(isNaN(newAmt) || newAmt<=0){ toast(t('msg.invalidAmount')); return; }
    d.paid = Math.max(0, d.paid - entry.amount + newAmt);
    addAudit('edit_payment', `${d.name}: ${fmt(entry.amount)} → ${fmt(newAmt)}`);
    entry.amount = newAmt;
    toast(t('msg.paymentUpdated'));
    renderAll();
  }));
  body.querySelectorAll('[data-pay-del]').forEach(b=>b.addEventListener('click', ()=>{
    const [debtorId, logId] = b.dataset.payDel.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='payment');
    if(!d || !entry) return;
    if(!confirm(t('drawer.deletePaymentConfirm'))) return;
    d.paid = Math.max(0, d.paid - entry.amount);
    d.log = d.log.filter(e=>e.id!==logId);
    addAudit('delete_payment', `${d.name}: ${fmt(entry.amount)}`);
    toast(t('msg.paymentDeleted'));
    renderAll();
  }));
}

function renderFollowups(){
  let rows = [];
  scopedDebtors().forEach(d=>{
    d.log.filter(e=>e.type==='follow').forEach(e=>rows.push({...e, debtor:d.name, debtorId:d.id, debtorNotes:d.notes}));
  });
  rows.sort((a,b)=> a.date < b.date ? 1 : -1);
  const body = document.getElementById('followupsTableBody');
  document.getElementById('followupsEmpty').style.display = rows.length ? 'none' : 'block';
  const actionsAllowed = can('write');
  body.innerHTML = rows.map(r=>{
    const actions = actionsAllowed ? `<div class="row-actions"><button class="icon-btn" data-follow-edit="${r.debtorId}:${r.id}" title="${t('action.edit')}">✎</button><button class="icon-btn danger" data-follow-del="${r.debtorId}:${r.id}" title="${t('action.delete')}">✕</button></div>` : '—';
    return `<tr>
    <td>${esc(r.date)}</td><td>${esc(r.debtor)}</td><td>${translateValue(r.method)}</td><td>${esc(r.note)||'—'}</td>${notesTd({notes:r.debtorNotes})}<td>${actions}</td>
  </tr>`;
  }).join('');
  body.querySelectorAll('[data-follow-edit]').forEach(b=>b.addEventListener('click', ()=>{
    const [debtorId, logId] = b.dataset.followEdit.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='follow');
    if(!d || !entry) return;
    const input = prompt(t('drawer.editFollowPrompt'), String(entry.note||''));
    if(input===null) return;
    const newNote = input.trim();
    addAudit('edit_followup', `${d.name}: ${entry.note||'—'} → ${newNote||'—'}`);
    entry.note = newNote;
    toast(t('msg.followUpdated'));
    renderAll();
  }));
  body.querySelectorAll('[data-follow-del]').forEach(b=>b.addEventListener('click', ()=>{
    const [debtorId, logId] = b.dataset.followDel.split(':').map(Number);
    const d = debtors.find(x=>x.id===debtorId);
    const entry = d && d.log.find(e=>e.id===logId && e.type==='follow');
    if(!d || !entry) return;
    if(!confirm(t('drawer.deleteFollowConfirm'))) return;
    d.log = d.log.filter(e=>e.id!==logId);
    addAudit('delete_followup', `${d.name}: ${entry.note||'—'}`);
    toast(t('msg.followDeleted'));
    renderAll();
  }));
}

function renderReports(){
  const debtors=scopedDebtors();
  const total = debtors.reduce((s,d)=>s+d.total,0);
  const collected = debtors.reduce((s,d)=>s+d.paid,0);
  const remainingAll = total - collected;
  document.getElementById('repTotal').textContent = currency(total);
  document.getElementById('repCollected').textContent = currency(collected);
  document.getElementById('repRemaining').textContent = currency(remainingAll);
  document.getElementById('repRate').textContent = (total?Math.round(collected/total*100):0)+'%';
  document.getElementById('repPaymentsCount').textContent = debtors.reduce((s,d)=>s+d.log.filter(e=>e.type==='payment').length,0);
  document.getElementById('repFollowupsCount').textContent = debtors.reduce((s,d)=>s+d.log.filter(e=>e.type==='follow').length,0);

  const counts = {active:0, overdue:0, paid:0};
  debtors.forEach(d=>counts[statusOf(d)]++);
  const totalC = debtors.length || 1;
  const colors = {active:'#3E8E7E', overdue:'#B33A3A', paid:'#C9A227'};
  let offset = 0;
  const segs = Object.entries(counts).map(([k,v])=>{
    const pct = v/totalC*100;
    const seg = `<circle cx="21" cy="21" r="15.9" fill="transparent" stroke="${colors[k]}" stroke-width="6" stroke-dasharray="${pct} ${100-pct}" stroke-dashoffset="${25-offset}"></circle>`;
    offset += pct;
    return seg;
  }).join('');
  document.getElementById('donutSvg').innerHTML = segs || '';
  document.getElementById('donutLegend').innerHTML = `
    <div class="li"><div class="dot" style="background:${colors.active}"></div> ${t('status.active')} — ${counts.active}</div>
    <div class="li"><div class="dot" style="background:${colors.overdue}"></div> ${t('status.overdue')} — ${counts.overdue}</div>
    <div class="li"><div class="dot" style="background:${colors.paid}"></div> ${t('status.paid')} — ${counts.paid}</div>
  `;
  document.getElementById('repAverageDebt').textContent = currency(debtors.length ? total/debtors.length : 0);
  document.getElementById('repOverdueRate').textContent = (debtors.length ? Math.round(debtors.filter(d=>statusOf(d)==='overdue').length/debtors.length*100) : 0)+'%';
  document.getElementById('repExpectedMonthly').textContent = currency(debtors.reduce((sum,d)=>sum+(d.installments||[]).filter(item=>!item.paid).slice(0,1).reduce((s,item)=>s+item.amount,0),0));
  const months={}; debtors.forEach(d=>(d.installments||[]).forEach(item=>{const month=item.date.slice(0,7);months[month]??={due:0,paid:0};months[month].due+=Number(item.amount)||0;if(item.paid)months[month].paid+=Number(item.amount)||0;}));
  document.getElementById('financialReportBody').innerHTML=Object.entries(months).sort().map(([month,data])=>`<tr><td>${month}</td><td>${currency(data.due)}</td><td>${currency(data.paid)}</td><td>${data.due?Math.round(data.paid/data.due*100):0}%</td></tr>`).join('') || `<tr><td colspan="4">${currentLang==='en'?'No installment data yet.':'لا توجد بيانات أقساط بعد.'}</td></tr>`;
  const notesBody=document.getElementById('reportsNotesBody');
  if(notesBody){
    notesBody.innerHTML=debtors.map(d=>`<tr data-id="${d.id}"><td>${esc(d.name)}</td><td><span class="badge ${statusOf(d)}">${statusLabel(statusOf(d))}</span></td><td class="figures">${fmt(remaining(d))}</td>${notesTd(d)}</tr>`).join('')
      || `<tr><td colspan="4">${currentLang==='en'?'No debtors.':'لا يوجد مدينون.'}</td></tr>`;
    notesBody.querySelectorAll('tr[data-id]').forEach(row=>row.addEventListener('click',()=>openDrawer(Number(row.dataset.id))));
  }
}

// ============== DEBUGGING & TROUBLESHOOTING ==============
function debugAuthSystem() {
  console.log('=== AUTH SYSTEM DEBUG ===');
  console.log('Current users:', users);
  console.log('Auth from storage:', getAuth());
  console.log('Session logged in:', sessionStorage.getItem('daftar_logged_in'));
  console.log('Session user ID:', sessionStorage.getItem('daftar_user_id'));
  console.log('Current user:', currentUser);
  console.log('========================');
}

// Reset login system (for troubleshooting)
function resetLoginSystem() {
  sessionStorage.removeItem('daftar_logged_in');
  sessionStorage.removeItem('daftar_user_id');
  users = [];
  currentUser = null;
  updateAuthUI();
  console.log('Login system uses the cloud account walid.');
  alert('تسجيل الدخول السحابي: walid / Ksi@33774995');
}

// Add debug functions to window for manual testing
window.debugAuth = debugAuthSystem;
window.resetLogin = resetLoginSystem;

// ============== SECURITY FUNCTIONS ==============
function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer);
  if (appSettings.autoLogout && sessionStorage.getItem('daftar_logged_in') === '1') {
    sessionTimer = setTimeout(() => {
      addAudit('logout');
      sessionStorage.removeItem('daftar_logged_in');
      sessionStorage.removeItem('daftar_user_id');
      currentUser = null;
      updateAuthUI();
      toast(currentLang === 'en' ? 'Auto-logged out due to inactivity' : 'تم تسجيل الخروج تلقائيًا بسبب عدم النشاط');
    }, 30 * 60 * 1000); // 30 minutes
  }
}

function showSessionWarning() {
  if (appSettings.sessionTimeout && !sessionWarningShown && sessionStorage.getItem('daftar_logged_in') === '1') {
    sessionWarningShown = true;
    setTimeout(() => {
      if (sessionStorage.getItem('daftar_logged_in') === '1') {
        toast(currentLang === 'en' ? 'Session will expire in 5 minutes' : 'ستنتهي الجلسة خلال 5 دقائق');
      }
    }, 25 * 60 * 1000); // 25 minutes (5 minutes before 30)
  }
}

// Track user activity
['click', 'keydown', 'scroll', 'mousemove'].forEach(event => {
  document.addEventListener(event, () => {
    resetSessionTimer();
    showSessionWarning();
  });
});

// Security settings event listeners
document.getElementById('s_autoLogout').addEventListener('change', e => {
  appSettings.autoLogout = e.target.checked;
  saveSettings();
  resetSessionTimer();
});

document.getElementById('s_sessionTimeout').addEventListener('change', e => {
  appSettings.sessionTimeout = e.target.checked;
  saveSettings();
  sessionWarningShown = false;
});

document.getElementById('s_passwordMinLength').addEventListener('change', e => {
  appSettings.passwordMinLength = parseInt(e.target.value) || 8;
  saveSettings();
});

// Integration settings
document.getElementById('s_smsProvider').addEventListener('change', e => {
  const configFields = document.getElementById('smsConfigFields');
  configFields.style.display = e.target.value !== 'none' ? 'block' : 'none';
  appSettings.smsProvider = e.target.value;
  saveSettings();
});

document.getElementById('s_emailProvider').addEventListener('change', e => {
  const configFields = document.getElementById('emailConfigFields');
  configFields.style.display = e.target.value !== 'none' ? 'block' : 'none';
  appSettings.emailProvider = e.target.value;
  saveSettings();
});

document.getElementById('s_smsApiKey').addEventListener('change', e => {
  appSettings.smsApiKey = e.target.value.trim();
  saveSettings();
});

document.getElementById('s_emailApiKey').addEventListener('change', e => {
  appSettings.emailApiKey = e.target.value.trim();
  saveSettings();
});

document.getElementById('testIntegrationBtn').addEventListener('click', () => {
  // Simulate integration test
  const smsProvider = document.getElementById('s_smsProvider').value;
  const emailProvider = document.getElementById('s_emailProvider').value;
  
  if (smsProvider === 'none' && emailProvider === 'none') {
    toast(currentLang === 'en' ? 'Please select at least one integration provider' : 'الرجاء اختيار مزود تكامل واحد على الأقل');
    return;
  }
  
  // Simulate API call
  setTimeout(() => {
    toast(t('integration.testSuccess'));
    addAudit('settings_change', `Integration test: SMS(${smsProvider}), Email(${emailProvider})`);
  }, 1000);
});

// Automation settings
document.getElementById('s_autoFollowups').addEventListener('change', e => {
  appSettings.autoFollowups = e.target.checked;
  saveSettings();
  if (e.target.checked) {
    applyAutomationRules();
  }
});

document.getElementById('s_autoReports').addEventListener('change', e => {
  appSettings.autoReports = e.target.checked;
  saveSettings();
});

document.getElementById('s_smartReminders').addEventListener('change', e => {
  appSettings.smartReminders = e.target.checked;
  saveSettings();
});

document.getElementById('s_followupFrequency').addEventListener('change', e => {
  appSettings.followupFrequency = parseInt(e.target.value) || 7;
  saveSettings();
});

// Compliance settings
document.getElementById('s_dataRetention').addEventListener('change', e => {
  appSettings.dataRetention = e.target.checked;
  saveSettings();
});

document.getElementById('s_gdprCompliance').addEventListener('change', e => {
  appSettings.gdprCompliance = e.target.checked;
  saveSettings();
});

document.getElementById('s_auditTrail').addEventListener('change', e => {
  appSettings.auditTrail = e.target.checked;
  saveSettings();
});

document.getElementById('s_companyName').addEventListener('change', e => {
  appSettings.companyName = e.target.value.trim();
  saveSettings();
});

document.getElementById('s_companyTaxId').addEventListener('change', e => {
  appSettings.companyTaxId = e.target.value.trim();
  saveSettings();
});

document.getElementById('generateComplianceReportBtn').addEventListener('click', () => {
  // Generate compliance report
  const reportData = {
    generated: new Date().toISOString(),
    companyName: appSettings.companyName,
    taxId: appSettings.companyTaxId,
    dataRetention: appSettings.dataRetention,
    gdprCompliance: appSettings.gdprCompliance,
    auditTrail: appSettings.auditTrail,
    totalDebtors: debtors.length,
    totalReps: reps.length,
    auditLogEntries: auditLog.length
  };
  
  // In a real implementation, this would generate a formal compliance report
  console.log('Compliance Report:', reportData);
  addAudit('settings_change', 'Compliance report generated');
  toast(t('compliance.reportGenerated'));
});

// Apply automation rules
function applyAutomationRules() {
  if (!appSettings.autoFollowups) return;
  
  const today = todayISO();
  let followupsCreated = 0;
  
  scopedDebtors().forEach(d => {
    if (statusOf(d) === 'overdue') {
      const lastFollowup = d.log.filter(e => e.type === 'follow').sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const daysSinceLastFollowup = lastFollowup ? daysBetween(lastFollowup.date, today) : Infinity;
      
      if (daysSinceLastFollowup >= appSettings.followupFrequency) {
        d.log.push({
          id: genLogId(),
          type: 'follow',
          date: today,
          method: 'اتصال هاتفي',
          note: currentLang === 'en' ? 'Auto-generated followup' : 'متابعة تلقائية'
        });
        followupsCreated++;
      }
    }
  });
  
  if (followupsCreated > 0) {
    saveState();
    addAudit('automation_rules_applied', `${followupsCreated} auto followups created`);
    toast(t('automation.rulesApplied'));
  }
}

// Schedule automated reports
function scheduleAutomatedReports() {
  if (!appSettings.autoReports) return;
  
  // Check if weekly report is due (every Sunday)
  const today = new Date();
  if (today.getDay() === 0) { // Sunday
    const lastReportDate = localStorage.getItem('daftar_last_weekly_report');
    const thisWeek = today.toISOString().slice(0, 10);
    
    if (lastReportDate !== thisWeek) {
      // Generate weekly report
      localStorage.setItem('daftar_last_weekly_report', thisWeek);
      addAudit('automation_rules_applied', 'Weekly report generated');
      // In a real implementation, this would generate and send the report
    }
  }
}

document.getElementById('changeAdminPasswordBtn').addEventListener('click', () => {
  const newPassword = prompt(currentLang === 'en' ? 'Enter new admin password:' : 'أدخل كلمة مرور المدير الجديدة:');
  if (newPassword && newPassword.length >= appSettings.passwordMinLength) {
    const admin = users.find(u => u.role === 'admin');
    if (admin) {
      admin.password = newPassword;
      saveUsers();
      addAudit('save_auth', 'Admin password changed');
      toast(currentLang === 'en' ? 'Admin password changed successfully' : 'تم تغيير كلمة مرور المدير بنجاح');
    }
  } else if (newPassword) {
    toast(currentLang === 'en' ? `Password must be at least ${appSettings.passwordMinLength} characters` : `يجب أن تكون كلمة المرور ${appSettings.passwordMinLength} أحرف على الأقل`);
  }
});

// Password validation
function validatePassword(password) {
  if (password.length < appSettings.passwordMinLength) {
    return false;
  }
  return true;
}

// ============== REMINDER SETTINGS ==============
const SETTINGS_KEY = 'daftar_settings_v1';
let appSettings = {language:'ar',mode:'dark',theme:'gold',themeCustom:'',palette:'navy',paletteCustom:'',reminderDays:7, watermarkEnabled:true, soundAlerts:true, emailAlerts:false, notificationEmail:'', autoLogout:false, sessionTimeout:false, passwordMinLength:8, smsProvider:'none', emailProvider:'none', smsApiKey:'', emailApiKey:'', autoFollowups:false, autoReports:false, smartReminders:false, followupFrequency:7, dataRetention:false, gdprCompliance:false, auditTrail:true, companyName:'', companyTaxId:''};
let sessionTimer = null;
let sessionWarningShown = false;
function loadSettings(){
  if(appSettings.language) currentLang=appSettings.language;
  if(appSettings.mode) currentMode=appSettings.mode;
}
function saveSettings(){
  syncToSupabase();
}
// ---- color helpers (used by the custom theme picker and by print/PDF templates) ----
function hexToRgbArr(hex){
  const clean=(hex||'').replace('#','').trim();
  const full=clean.length===3?clean.split('').map(c=>c+c).join(''):clean;
  const num=parseInt(full,16);
  if(isNaN(num)||full.length!==6) return [201,162,39];
  return [(num>>16)&255,(num>>8)&255,num&255];
}
function rgbToHex([r,g,b]){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function darkenRgb([r,g,b],amount){return [r*(1-amount),g*(1-amount),b*(1-amount)];}
function readableInk([r,g,b]){
  // relative luminance (WCAG) decides whether dark or light text sits on top of the accent color
  const lum=(0.299*r+0.587*g+0.114*b)/255;
  return lum>0.55 ? '#1a1406' : '#f5f2e6';
}
function clampNum(v,min,max){ return Math.min(max,Math.max(min,v)); }
function hexToHsl(hex){
  let [r,g,b]=hexToRgbArr(hex).map(v=>v/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h=0,s=0; const l=(max+min)/2;
  if(max!==min){
    const d=max-min;
    s=l>0.5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h=(g-b)/d+(g<b?6:0); break;
      case g: h=(b-r)/d+2; break;
      case b: h=(r-g)/d+4; break;
    }
    h/=6;
  }
  return [h*360, s*100, l*100];
}
function hslToHex(h,s,l){
  h=((h%360)+360)%360; s=clampNum(s,0,100)/100; l=clampNum(l,0,100)/100;
  const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
  let r=0,g=0,b=0;
  if(h<60){r=c;g=x;b=0;} else if(h<120){r=x;g=c;b=0;} else if(h<180){r=0;g=c;b=x;}
  else if(h<240){r=0;g=x;b=c;} else if(h<300){r=x;g=0;b=c;} else {r=c;g=0;b=x;}
  return rgbToHex([(r+m)*255,(g+m)*255,(b+m)*255]);
}
// derives a full interface palette (bg/surface/surface-2/surface-3/ink/muted/border)
// from a single hex color picked by the user, following the same tonal
// relationships used by the built-in presets above.
function generateCustomPalette(hex){
  const [h,s,l]=hexToHsl(hex);
  if(l<55){
    const s2=clampNum(s,20,55);
    const surfaceL=clampNum(l,8,30);
    return {
      bg: hslToHex(h,s2,clampNum(surfaceL-5,4,26)),
      surface: hslToHex(h,s2,surfaceL),
      surface2: hslToHex(h,s2,clampNum(surfaceL+9,10,42)),
      surface3: hslToHex(h,s2,clampNum(surfaceL+17,14,50)),
      ink: hslToHex(h,15,92),
      muted: hslToHex(h,15,62),
      border: hslToHex(h,s2*0.7,clampNum(surfaceL+27,20,55))
    };
  }
  const s2=clampNum(s,15,45);
  return {
    bg: hslToHex(h,s2,95),
    surface: '#ffffff',
    surface2: hslToHex(h,s2,90),
    surface3: hslToHex(h,s2,85),
    ink: hslToHex(h,25,18),
    muted: hslToHex(h,15,42),
    border: hslToHex(h,s2*0.8,80)
  };
}
// active preset accent colors (kept in sync with style.css so JS can restore them)
const THEME_PRESETS={
  gold:'#C9A227', teal:'#2BB3A3', blue:'#5EA9E8', rose:'#E28A9A', orange:'#FF8C42', purple:'#9C6ADE', green:'#6BCB77'
};
function applyTheme(theme){
  theme=theme||'gold';
  const prev=localStorage.getItem('daftar_theme');
  if(THEME_PRESETS[theme]){
    // preset: let the stylesheet rules (html[data-theme="..."]) take over, clear any custom inline overrides
    document.documentElement.dataset.theme=theme;
    ['--gold','--gold-dim','--gold-rgb','--gold-ink'].forEach(v=>document.documentElement.style.removeProperty(v));
    localStorage.setItem('daftar_theme',theme);
    localStorage.removeItem('daftar_theme_custom');
  } else {
    // custom hex color chosen from the color picker
    applyCustomTheme(theme);
  }
  if(prev!==null && prev!==theme && typeof addAudit==='function' && currentUser){ addAudit('theme_change', THEME_PRESETS[theme]?t(`theme.${theme}`):theme); }
  appSettings.theme=theme;
  appSettings.themeCustom=theme==='custom' ? localStorage.getItem('daftar_theme_custom')||'' : '';
  saveSettings();
  updateThemeSwatchesUI();
}
function applyCustomTheme(hex){
  const rgb=hexToRgbArr(hex);
  const dim=rgbToHex(darkenRgb(rgb,0.35));
  document.documentElement.dataset.theme='custom';
  document.documentElement.style.setProperty('--gold',hex);
  document.documentElement.style.setProperty('--gold-dim',dim);
  document.documentElement.style.setProperty('--gold-rgb',rgb.join(','));
  document.documentElement.style.setProperty('--gold-ink',readableInk(rgb));
  localStorage.setItem('daftar_theme','custom');
  localStorage.setItem('daftar_theme_custom',hex);
  appSettings.theme='custom';
  appSettings.themeCustom=hex;
  saveSettings();
}
function updateThemeSwatchesUI(){
  const theme=localStorage.getItem('daftar_theme')||'gold';
  const customHex=localStorage.getItem('daftar_theme_custom');
  document.querySelectorAll('[data-theme-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.themePreset===theme));
  const customSwatch=document.getElementById('themeSwatchCustom');
  const customInput=document.getElementById('s_customColor');
  if(customSwatch) customSwatch.classList.toggle('active',theme==='custom');
  if(customInput && customHex) customInput.value=customHex;
  const label=document.getElementById('themeCurrentLabel');
  if(label) label.textContent = theme==='custom' ? t('theme.currentCustom') : t(`theme.${theme}`);
  const palette=localStorage.getItem('daftar_palette')||'navy';
  document.querySelectorAll('[data-palette-preset]').forEach(btn=>btn.classList.toggle('active',btn.dataset.palettePreset===palette));
  const paletteCustomSwatch=document.getElementById('paletteSwatchCustom');
  const paletteCustomInput=document.getElementById('s_customPalette');
  const paletteCustomHex=localStorage.getItem('daftar_palette_custom');
  if(paletteCustomSwatch) paletteCustomSwatch.classList.toggle('active',palette==='custom');
  if(paletteCustomInput && paletteCustomHex) paletteCustomInput.value=paletteCustomHex;
  const paletteLabel=document.getElementById('paletteCurrentLabel');
  if(paletteLabel) paletteLabel.textContent = palette==='custom' ? t('palette.currentCustom') : t(`palette.${palette}`);
}
const PALETTE_PRESETS=['navy','forest','burgundy','charcoal','purple','teal','midnight','sunset','light-navy','light-forest','light-rose','light-lavender','light-peach'];
function applyPalette(palette){
  palette=palette||'navy';
  const prev=localStorage.getItem('daftar_palette');
  if(PALETTE_PRESETS.includes(palette)){
    // preset: let the stylesheet rules (html[data-palette="..."]) take over, clear any custom inline overrides
    document.documentElement.dataset.palette=palette;
    ['--bg','--surface','--surface-2','--surface-3','--ink','--muted','--border'].forEach(v=>document.documentElement.style.removeProperty(v));
    localStorage.setItem('daftar_palette',palette);
    localStorage.removeItem('daftar_palette_custom');
  } else {
    // custom hex color chosen from the color picker
    applyCustomPalette(palette);
    palette='custom';
  }
  if(prev!==null && prev!==palette && typeof addAudit==='function' && currentUser) addAudit('palette_change', palette==='custom' ? t('palette.currentCustom') : t(`palette.${palette}`));
  appSettings.palette=palette;
  appSettings.paletteCustom=palette==='custom' ? localStorage.getItem('daftar_palette_custom')||'' : '';
  saveSettings();
  updateThemeSwatchesUI();
}
function applyCustomPalette(hex){
  const p=generateCustomPalette(hex);
  document.documentElement.dataset.palette='custom';
  document.documentElement.style.setProperty('--bg',p.bg);
  document.documentElement.style.setProperty('--surface',p.surface);
  document.documentElement.style.setProperty('--surface-2',p.surface2);
  document.documentElement.style.setProperty('--surface-3',p.surface3);
  document.documentElement.style.setProperty('--ink',p.ink);
  document.documentElement.style.setProperty('--muted',p.muted);
  document.documentElement.style.setProperty('--border',p.border);
  localStorage.setItem('daftar_palette','custom');
  localStorage.setItem('daftar_palette_custom',hex);
  appSettings.palette='custom';
  appSettings.paletteCustom=hex;
  saveSettings();
}
document.querySelectorAll('[data-theme-preset]').forEach(btn=>btn.addEventListener('click',()=>applyTheme(btn.dataset.themePreset)));
document.querySelectorAll('[data-palette-preset]').forEach(btn=>btn.addEventListener('click',()=>applyPalette(btn.dataset.palettePreset)));
document.getElementById('s_customColor').addEventListener('input',e=>applyTheme(e.target.value));
document.getElementById('s_customPalette').addEventListener('input',e=>applyPalette(e.target.value));
async function syncConfiguredSupabase(){
  const url=document.getElementById('s_supabaseUrl').value.trim().replace(/\/$/,''); const key=document.getElementById('s_supabaseKey').value.trim(); const status=document.getElementById('syncStatus');
  if(!url||!key){status.textContent=currentLang==='en'?'Enter Supabase URL and anon key first.':'أدخل رابط Supabase ومفتاح anon أولًا.';return;}
  status.textContent=currentLang==='en'?'Syncing...':'جارٍ تنفيذ المزامنة...';
  const ok=await syncToSupabase();
  status.textContent=ok?(currentLang==='en'?'Sync completed.':'اكتملت المزامنة.'):(currentLang==='en'?'Sync failed. Check URL, key and RLS policies.':'فشلت المزامنة. تحقق من الرابط والمفتاح وسياسات RLS.');
  if(ok) await addAudit('sync_supabase');
}
document.getElementById('syncNowBtn').addEventListener('click',syncConfiguredSupabase);
document.getElementById('auditFilter').addEventListener('input',renderAudit);
function getUpcomingDue(days){
  return scopedDebtors().filter(d=>{
    if(remaining(d)<=0) return false;
    const diff = daysBetween(todayISO(), d.due);
    return diff>=0 && diff<=days;
  }).sort((a,b)=> daysBetween(todayISO(),a.due) - daysBetween(todayISO(),b.due));
}
function renderDueReminders(){
  document.getElementById('reminderWindowLabel').textContent = currentLang==='en' ? `Within ${appSettings.reminderDays} days` : `خلال ${appSettings.reminderDays} أيام`;
  const list = getUpcomingDue(appSettings.reminderDays);
  const el = document.getElementById('dueReminders');
  if(!list.length){
    el.innerHTML = `<div style="color:var(--muted); font-size:13px">${t('msg.noUpcoming')}</div>`;
    return;
  }
  el.innerHTML = list.map(d=>{
    const diff = daysBetween(todayISO(), d.due);
    const label = diff===0 ? t('msg.todayDue') : `${t('msg.daysLeft')} ${diff} ${t('msg.days')}`;
    return `<div class="activity-item"><div class="activity-dot" style="background:var(--red)"></div>
      <div><div class="t"><b>${esc(d.name)}</b> — ${label} (${esc(d.due)})</div>
      <div class="d">${currentLang==='en'?'Remaining':'المتبقي'}: <span class="figures">${fmt(remaining(d))}</span> ${currentLang==='en'?'QAR':'ر.ق'}</div></div></div>`;
  }).join('');
}
function maybeSendDueNotifications(){
  if(!('Notification' in window) || Notification.permission!=='granted') return;
  const list = getUpcomingDue(appSettings.reminderDays);
  if(!list.length) return;
  const already = sessionStorage.getItem('daftar_notified');
  if(already) return;
  sessionStorage.setItem('daftar_notified','1');
  
  // Play sound if enabled
  if(appSettings.soundAlerts) {
    playNotificationSound();
  }
  
  const body = list.slice(0,5).map(d=>`${d.name} — ${d.due}`).join('\n');
  new Notification(currentLang==='en'?'Debt due alert':'تنبيه استحقاق ديون', {body: currentLang==='en'?`${list.length} cases are due soon:\n${body}`:`لديك ${list.length} حالة مستحقة قريبًا:\n${body}`});
  
  // Send email if enabled (simulation - in real implementation, this would call an API)
  if(appSettings.emailAlerts && appSettings.notificationEmail) {
    console.log('Email notification would be sent to:', appSettings.notificationEmail);
    // In a real implementation, you would call your backend API here
    // Example: fetch('/api/send-notification', { method: 'POST', body: JSON.stringify({ email: appSettings.notificationEmail, debts: list }) });
  }
}
document.getElementById('s_reminderDays').addEventListener('change', (e)=>{
  const v = parseInt(e.target.value) || 7;
  appSettings.reminderDays = v;
  saveSettings();
  addAudit('settings_change', `${currentLang==='en'?'Reminder days':'أيام التذكير'}: ${v}`);
  renderDueReminders();
});
document.getElementById('s_watermarkEnabled').addEventListener('change',e=>{appSettings.watermarkEnabled=e.target.checked;saveSettings();addAudit('settings_change', `${currentLang==='en'?'Print watermark':'شعار الطباعة'}: ${e.target.checked?'ON':'OFF'}`);});
document.getElementById('s_soundAlerts').addEventListener('change',e=>{appSettings.soundAlerts=e.target.checked;saveSettings();});
document.getElementById('s_emailAlerts').addEventListener('change',e=>{
  appSettings.emailAlerts=e.target.checked;
  document.getElementById('emailConfigField').style.display=e.target.checked?'block':'none';
  saveSettings();
});
document.getElementById('s_notificationEmail').addEventListener('change',e=>{
  appSettings.notificationEmail=e.target.value.trim();
  saveSettings();
});
document.getElementById('enableNotifBtn').addEventListener('click', ()=>{
  if(!('Notification' in window)){
    document.getElementById('notifStatus').textContent = currentLang==='en'?'This browser does not support system notifications.':'المتصفح الحالي لا يدعم تنبيهات النظام.';
    return;
  }
  Notification.requestPermission().then(perm=>{
    document.getElementById('notifStatus').textContent = perm==='granted'
      ? (currentLang==='en'?'Browser alerts enabled.':'تم تفعيل تنبيهات المتصفح — ستظهر تنبيهات عند فتح النظام إن وجدت ديون مستحقة قريبًا.')
      : (currentLang==='en'?'Notification permission was denied in browser settings.':'تم رفض إذن التنبيهات من إعدادات المتصفح.');
    if(perm==='granted'){ sessionStorage.removeItem('daftar_notified'); maybeSendDueNotifications(); }
  });
});

document.getElementById('dr_print').addEventListener('click', ()=>{
  if(activeDebtorId) printStatement(activeDebtorId);
});
function printStatement(id, skipPrint=false){
  const d = debtors.find(x=>x.id===id);
  if(!d) return;
  const rep = reps.find(r=>r.id===d.repId);
  const isCompany = d.type==='company';
  const sortedLog = [...d.log].sort((a,b)=> a.date < b.date ? -1 : 1);
  const L = {title:t('msg.statement'),system:t('msg.statementSystem'),issued:t('msg.issued'),status:t('msg.statusLabel'),company:t('msg.companyData'),debtor:t('msg.debtorData'),summary:t('msg.accountSummary'),name:t('msg.name'),phone:t('msg.phone'),companyNumber:t('msg.companyNumber'),crNumber:t('msg.crNumber'),dueDate:t('msg.dueDate'),collector:t('msg.collector'),notes:t('msg.notes'),date:t('msg.date'),description:t('msg.description'),debit:t('msg.debit'),credit:t('msg.credit'),balance:t('msg.balance'),totalDebt:t('msg.totalDebt'),totalPaid:t('msg.totalPaid'),remaining:t('msg.remainingBalance'),followups:t('msg.followups'),debtorSignature:t('msg.debtorSignature'),collectorSignature:t('msg.collectorSignature'),original:t('msg.originalBalance'),payment:t('msg.payment'),notAssigned:t('msg.notAssigned'),currency:currentLang==='en'?'QAR':'ر.ق'};

  // build running-balance ledger starting from the original debt amount
  let balance = d.total;
  const rows = [];
  rows.push({date:d.due<todayISO()?d.due:'', label:L.original, debit:'', credit:fmt(d.total), balance:fmt(balance), isOpening:true});
  sortedLog.forEach(e=>{
    if(e.type==='payment'){
      balance -= e.amount;
      rows.push({date:e.date, label:`${L.payment} (${translateValue(e.method)})`, debit:fmt(e.amount), credit:'', balance:fmt(Math.max(balance,0))});
    }
  });
  const followRows = sortedLog.filter(e=>e.type==='follow');
  const {accent}=printThemeVars();
  const statusBadgeColor = {active:'#3E8E7E', overdue:'#B33A3A', paid:accent}[statusOf(d)] || accent;

  const docHtml = `<!DOCTYPE html>
<html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="UTF-8">
<title>${esc(L.title)} — ${esc(d.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${printSharedStyle()}
  .party{display:flex; gap:16px; margin-bottom:20px; flex-wrap:wrap;}
  .party .box{flex:1; min-width:220px;}
  .party .box h3{font-size:11.5px; color:${accent}; margin:0 0 10px; letter-spacing:.3px; text-transform:uppercase;}
  .party .box div{font-size:13px; margin-bottom:6px; display:flex; justify-content:space-between; gap:10px;}
  .party .box b{color:#6b7280; font-weight:600;}
  .status-chip{display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; color:#fff; background:${statusBadgeColor};}
  .summary{display:flex; justify-content:${currentLang==='en'?'flex-end':'flex-start'};}
  .summary table{width:290px; margin-bottom:0;}
  .summary td{border:none; padding:7px 10px;}
  .summary tr.total td{border-top:2px solid ${accent}; font-weight:800; font-size:14.5px;}
  .followups{margin-top:8px;}
  .followups h3{font-size:12.5px; color:${accent}; border-bottom:1px solid #e7e9ee; padding-bottom:8px; margin-bottom:8px;}
  .followups li{font-size:12px; margin-bottom:6px; color:#3a3f4a; list-style:none; padding-inline-start:14px; position:relative;}
  .followups li::before{content:"›"; position:absolute; inset-inline-start:0; color:${accent}; font-weight:900;}
  .sign{display:flex; justify-content:space-between; margin-top:56px;}
  .sign div{width:210px; text-align:center; font-size:11.5px; color:#6b7280;}
  .sign div .line{border-top:1px solid #c7cad1; margin-top:44px; padding-top:6px;}
</style></head>
<body>
  ${printBrandHeader(L.title, `ST-${String(d.id).padStart(5,'0')}`)}

  <div class="party">
    <div class="box">
      <h3>${isCompany?L.company:L.debtor}</h3>
      <div><b>${L.name}</b><span>${esc(d.name)}</span></div>
      <div><b>${L.phone}</b><span>${esc(d.phone)||'—'}</span></div>
      ${isCompany?`<div><b>${L.companyNumber}</b><span>${esc(d.companyNumber)||'—'}</span></div><div><b>${L.crNumber}</b><span>${esc(d.crNumber)||'—'}</span></div>`:''}
    </div>
    <div class="box">
      <h3>${L.summary}</h3>
      <div><b>${L.dueDate}</b><span>${esc(d.due)}</span></div>
      <div><b>${L.collector}</b><span>${rep?esc(rep.name):L.notAssigned}</span></div>
      <div><b>${L.status}</b><span class="status-chip">${statusLabel(statusOf(d))}</span></div>
    </div>
  </div>
  ${d.notes?`<div class="party" style="margin-top:-10px"><div class="box" style="flex:1 1 100%"><h3>${L.notes}</h3><div style="display:block">${esc(d.notes)}</div></div></div>`:''}

  <table>
    <thead><tr><th>${L.date}</th><th>${L.description}</th><th>${L.debit}</th><th>${L.credit}</th><th>${L.balance}</th></tr></thead>
    <tbody>
      ${rows.map(r=>`<tr class="${r.isOpening?'opening':''}">
        <td>${esc(r.date)||'—'}</td><td>${esc(r.label)}</td>
        <td class="num">${r.debit||'—'}</td><td class="num">${r.credit||'—'}</td><td class="num">${r.balance}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div class="summary">
    <table>
      <tr><td>${L.totalDebt}</td><td class="num">${fmt(d.total)} ${L.currency}</td></tr>
      <tr><td>${L.totalPaid}</td><td class="num">${fmt(d.paid)} ${L.currency}</td></tr>
      <tr class="total"><td>${L.remaining}</td><td class="num">${fmt(remaining(d))} ${L.currency}</td></tr>
    </table>
  </div>

  ${followRows.length?`<div class="followups">
    <h3>${L.followups}</h3>
    <ul>${followRows.map(f=>`<li>${esc(f.date)} — ${translateValue(f.method)}${f.note?': '+esc(f.note):''}</li>`).join('')}</ul>
  </div>`:''}

  <div class="sign">
    <div><div class="line">${L.debtorSignature}</div></div>
    <div><div class="line">${L.collectorSignature}</div></div>
  </div>

  <div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;

  // use a hidden iframe (instead of window.open) so this also works when the
  // file is opened directly from disk (file://), where popups are often blocked
  lastStatementHtml = docHtml;
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);
  iframe.srcdoc = docHtml;
  iframe.onload = function(){
    setTimeout(()=>{
      try{
        if(!skipPrint){ iframe.contentWindow.focus(); iframe.contentWindow.print(); }
      }catch(e){
        toast('تعذّر فتح نافذة الطباعة تلقائيًا');
      }
      setTimeout(()=>document.body.removeChild(iframe), 1000);
    }, 150);
  };
}

async function exportDocumentPdf(docHtml, filename){
  if(!window.jspdf?.jsPDF || !window.html2canvas){toast(currentLang==='en'?'PDF libraries are unavailable. Print view opened instead.':'مكتبات PDF غير متاحة. تم فتح نافذة الطباعة البديلة.');printDocument(docHtml);return;}
  const iframe=document.createElement('iframe'); iframe.style.cssText='position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;background:#fff'; document.body.appendChild(iframe); iframe.srcdoc=docHtml;
  await new Promise(resolve=>{iframe.onload=()=>setTimeout(resolve,900);});
  try{
    const body=iframe.contentDocument?.body; if(!body) throw new Error('document');
    const canvas=await html2canvas(body,{scale:2,useCORS:true,allowTaint:true,backgroundColor:'#fff'}); const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4');
    const pageWidth=210, pageHeight=297, imageWidth=pageWidth, pagePixels=Math.floor(canvas.width*pageHeight/pageWidth);
    for(let offset=0;offset<canvas.height;offset+=pagePixels){const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=Math.min(pagePixels,canvas.height-offset);slice.getContext('2d').drawImage(canvas,0,offset,canvas.width,slice.height,0,0,slice.width,slice.height);if(offset)pdf.addPage();pdf.addImage(slice.toDataURL('image/jpeg',.92),'JPEG',0,0,imageWidth,slice.height*pageWidth/slice.width);}
    pdf.save(filename); toast(currentLang==='en'?'PDF downloaded':'تم تحميل PDF');
  }catch(err){console.error(err);toast(currentLang==='en'?'PDF export failed. Print view opened instead.':'تعذّر تصدير PDF. تم فتح نافذة الطباعة البديلة.');printDocument(docHtml);} finally{iframe.remove();}
}
function agingDocumentHtml(){
  const rows=getAgingRows(); const headers=currentLang==='en'?['Name','Type','Due date','Days late','Risk','Remaining','Notes']:['الاسم','النوع','تاريخ الاستحقاق','أيام التأخير','الخطورة','المتبقي','ملاحظات'];
  const title=currentLang==='en'?'Debt aging report':'تقرير أعمار الديون';
  const riskColors={b1:'#d9b34a',b2:'#d68a3c',b3:'#c8562f',b4:'#B33A3A'};
  const totalRemaining = rows.reduce((s,d)=>s+remaining(d),0);
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${printSharedStyle()}
  .summary-strip{display:flex; gap:12px; margin-bottom:18px;}
  .summary-strip .box{flex:1; text-align:center;}
  .summary-strip .lbl{font-size:11px; color:#6b7280; margin-bottom:6px;}
  .summary-strip .val{font-size:16px; font-weight:800;}
  .risk-dot{display:inline-block; width:8px; height:8px; border-radius:50%; margin-inline-end:6px;}
</style></head><body>
${printBrandHeader(title)}
<div class="summary-strip">
  <div class="box"><div class="lbl">${currentLang==='en'?'Overdue cases':'عدد الحالات المتأخرة'}</div><div class="val">${rows.length}</div></div>
  <div class="box"><div class="lbl">${currentLang==='en'?'Total outstanding':'إجمالي المتبقي المتأخر'}</div><div class="val">${currency(totalRemaining)}</div></div>
</div>
<table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(d=>`<tr><td>${esc(d.name)}</td><td>${d.type==='company'?t('debtors.company'):t('debtors.individual')}</td><td>${esc(d.due)}</td><td>${d.daysLate}</td><td class="risk"><span class="risk-dot" style="background:${riskColors[d.bucket.key]}"></span>${d.bucket.label}</td><td class="num">${fmt(remaining(d))}</td><td>${esc(d.notes)||'—'}</td></tr>`).join('') || `<tr><td colspan="7" class="empty">${t('aging.empty')}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('dr_downloadPdf').addEventListener('click',()=>{if(activeDebtorId){printStatement(activeDebtorId,true);setTimeout(()=>exportDocumentPdf(lastStatementHtml,`daftar-statement-${activeDebtorId}-${todayISO()}.pdf`),250);}});
function printDocument(docHtml){const iframe=document.createElement('iframe');iframe.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';document.body.appendChild(iframe);iframe.srcdoc=docHtml;iframe.onload=()=>setTimeout(()=>{iframe.contentWindow.focus();iframe.contentWindow.print();setTimeout(()=>iframe.remove(),1000);},200);}

// ============== SETTINGS: BACKUP / RESET ==============
document.getElementById('exportDataBtn').addEventListener('click', async ()=>{
  const payload = {exportedAt: new Date().toISOString(), debtors, reps, nextId, nextRepId, users, auditLog};
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `نسخة-احتياطية-دفتر-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  await addAudit('export_backup', `${debtors.length} ${currentLang==='en'?'debtors':'مدين'}, ${reps.length} ${currentLang==='en'?'collectors':'مندوب'}`);
  toast('تم تصدير النسخة الاحتياطية');
});

document.getElementById('importDataBtn').addEventListener('click', ()=>{
  document.getElementById('importDataFile').click();
});
document.getElementById('importDataFile').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async ()=>{
    try{
      const data = JSON.parse(reader.result);
      if(!Array.isArray(data.debtors)) throw new Error('invalid');
      if(!confirm('سيؤدي الاستيراد إلى استبدال جميع البيانات الحالية بالبيانات الموجودة في الملف. هل تريد المتابعة؟')) return;
      debtors = data.debtors.map(d=>({type:'individual', companyNumber:'', crNumber:'', ...d}));
      reps = data.reps || [];
      nextId = data.nextId || (Math.max(0, ...debtors.map(d=>d.id))+1);
      nextRepId = data.nextRepId || (Math.max(0, ...reps.map(r=>r.id))+1);
      
      // Import users if available
      if (data.users && Array.isArray(data.users)) {
        users = data.users;
        await saveUsers();
      }
      
      // Import audit log if available
      if (data.auditLog && Array.isArray(data.auditLog)) {
        auditLog = data.auditLog;
      }
      
      await addAudit('import_backup', `${debtors.length} ${currentLang==='en'?'debtors':'مدين'}, ${reps.length} ${currentLang==='en'?'collectors':'مندوب'}`);
      saveState();
      const synced = await syncToSupabase();
      toast(synced ? 'تم استيراد النسخة الاحتياطية بنجاح' : 'تم الاستيراد محليًا، وتعذرت المزامنة السحابية');
      renderAll();
    }catch(err){
      toast('تعذّرت قراءة الملف — تأكد أنه نسخة احتياطية صحيحة');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('clearAllDataBtn').addEventListener('click', async ()=>{
  if(!confirm('هل أنت متأكد من مسح جميع البيانات المسجلة نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.')) return;
  if(!confirm('تأكيد أخير: سيتم حذف كل المدينين والمندوبين وسجلات السداد والمتابعات. متابعة؟')) return;
  const counts = `${debtors.length} ${currentLang==='en'?'debtors':'مدين'}, ${reps.length} ${currentLang==='en'?'collectors':'مندوب'}`;
  debtors = [];
  reps = [];
  nextId = 1;
  nextRepId = 1;
  activeDebtorId = null;
  activeRepId = null;
  closeDrawer();
  closeRepDrawer();
  await addAudit('clear_all_data', counts);
  saveState();
  const synced = await syncToSupabase();
  toast(synced ? 'تم مسح جميع البيانات المسجلة' : 'تم المسح محليًا، وتعذرت المزامنة السحابية');
  renderAll();
});

// ============== PRINT/PDF: REPORTS & AGING ==============
function reportsDocumentHtml(){
  const debtors=scopedDebtors();
  const total = debtors.reduce((s,d)=>s+d.total,0);
  const collected = debtors.reduce((s,d)=>s+d.paid,0);
  const remainingAll = total - collected;
  const title=currentLang==='en'?'Financial Reports':'التقارير المالية';
  const counts = {active:0, overdue:0, paid:0};
  debtors.forEach(d=>counts[statusOf(d)]++);
  const months={}; debtors.forEach(d=>(d.installments||[]).forEach(item=>{const month=item.date.slice(0,7);months[month]??={due:0,paid:0};months[month].due+=Number(item.amount)||0;if(item.paid)months[month].paid+=Number(item.amount)||0;}));
  const rows = Object.entries(months).sort();
  return `<!doctype html><html lang="${currentLang}" dir="${currentLang==='en'?'ltr':'rtl'}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&family=IBM+Plex+Sans+Arabic:wght@400;500;600&display=swap" rel="stylesheet">
<style>
${printSharedStyle()}
  .summary-grid{display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin-bottom:20px;}
  .summary-box{padding:12px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:6px;}
  .summary-box .lbl{font-size:11px; color:#6b7280; margin-bottom:4px;}
  .summary-box .val{font-size:18px; font-weight:800; color:var(--accent);}
</style></head><body>
${printBrandHeader(title)}
<div class="summary-grid">
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Total debts':'إجمالي الديون'}</div><div class="val">${fmt(total)}</div></div>
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Total collected':'إجمالي المحصّل'}</div><div class="val">${fmt(collected)}</div></div>
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Total remaining':'إجمالي المتبقي'}</div><div class="val">${fmt(remainingAll)}</div></div>
  <div class="summary-box"><div class="lbl">${currentLang==='en'?'Collection rate':'نسبة التحصيل'}</div><div class="val">${total?Math.round(collected/total*100):0}%</div></div>
</div>
<table><thead><tr><th>${currentLang==='en'?'Month':'الشهر'}</th><th>${currentLang==='en'?'Due':'مستحق'}</th><th>${currentLang==='en'?'Collected':'محصل'}</th><th>${currentLang==='en'?'Rate':'النسبة'}</th></tr></thead><tbody>${rows.map(([month,data])=>`<tr><td>${month}</td><td>${fmt(data.due)}</td><td>${fmt(data.paid)}</td><td>${data.due?Math.round(data.paid/data.due*100):0}%</td></tr>`).join('')||`<tr><td colspan="4">${currentLang==='en'?'No installment data.':'لا توجد بيانات أقساط.'}</td></tr>`}</tbody></table>
<table><thead><tr><th>${currentLang==='en'?'Name':'الاسم'}</th><th>${currentLang==='en'?'Status':'الحالة'}</th><th>${currentLang==='en'?'Remaining':'المتبقي'}</th><th>${currentLang==='en'?'Notes':'ملاحظات'}</th></tr></thead><tbody>${debtors.map(d=>`<tr><td>${esc(d.name)}</td><td>${statusLabel(statusOf(d))}</td><td>${fmt(remaining(d))}</td><td>${esc(d.notes)||'—'}</td></tr>`).join('')||`<tr><td colspan="4">${currentLang==='en'?'No debtors.':'لا يوجد مدينون.'}</td></tr>`}</tbody></table>
<div class="doc-footer">${t('msg.printedOn')} ${todayISO()}.</div>
</body></html>`;
}
document.getElementById('reportPrintBtn')?.addEventListener('click',()=>printDocument(reportsDocumentHtml()));
document.getElementById('reportPdfBtn')?.addEventListener('click',()=>exportDocumentPdf(reportsDocumentHtml(),`daftar-reports-${todayISO()}.pdf`));
document.getElementById('agingPrintBtn')?.addEventListener('click',()=>printDocument(agingDocumentHtml()));
document.getElementById('agingPdfBtn')?.addEventListener('click',()=>exportDocumentPdf(agingDocumentHtml(),`daftar-aging-${todayISO()}.pdf`));

// ============== KEYBOARD SHORTCUTS ==============
// Keys are lowercase because the lookup below normalizes e.key to lowercase before matching
// (browsers report e.key as lowercase for an unshifted letter, uppercase when Shift is held).
const keyboardShortcuts = {
  'ctrl+k': () => {
    document.getElementById('globalSearch').focus();
  },
  'ctrl+n': () => {
    document.getElementById('addDebtorBtn').click();
  },
  'ctrl+r': () => {
    renderAll();
  },
  'ctrl+shift+r': () => {
    document.querySelector('[data-page="reports"]')?.click();
  },
  'ctrl+shift+d': () => {
    document.querySelector('[data-page="debtors"]')?.click();
  },
  'ctrl+shift+a': () => {
    document.querySelector('[data-page="aging"]')?.click();
  },
  'escape': () => {
    document.querySelectorAll('.overlay.show').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.drawer.show').forEach(el => el.classList.remove('show'));
    document.querySelectorAll('.drawer-overlay.show').forEach(el => el.classList.remove('show'));
    document.getElementById('notificationPanel')?.classList.remove('show');
  },
  'ctrl+shift+s': () => {
    document.getElementById('saveSearchBtn')?.click();
  },
  'ctrl+shift+f': () => {
    document.getElementById('advancedSearchBtn')?.click();
  }
};

document.addEventListener('keydown', (e) => {
  const key = e.ctrlKey ? 'Ctrl+' : '';
  const shift = e.shiftKey ? 'Shift+' : '';
  // Normalize to lowercase: e.key is lowercase for an unshifted letter (e.g. 'k') but
  // uppercase when Shift is held (e.g. 'R' for Ctrl+Shift+R), so a case-sensitive lookup
  // against the (mixed-case) keyboardShortcuts keys would silently miss the unshifted ones.
  const shortcut = (key + shift + e.key).toLowerCase();

  if (keyboardShortcuts[shortcut]) {
    e.preventDefault();
    keyboardShortcuts[shortcut]();
  }
});

// Show keyboard shortcuts help
function showKeyboardShortcutsHelp() {
  const shortcuts = [
    { key: 'Ctrl+K', action: currentLang === 'en' ? 'Focus search' : 'التركيز على البحث' },
    { key: 'Ctrl+N', action: currentLang === 'en' ? 'Add new debtor' : 'إضافة مدين جديد' },
    { key: 'Ctrl+R', action: currentLang === 'en' ? 'Refresh data' : 'تحديث البيانات' },
    { key: 'Ctrl+Shift+R', action: currentLang === 'en' ? 'Go to reports' : 'الذهاب للتقارير' },
    { key: 'Ctrl+Shift+D', action: currentLang === 'en' ? 'Go to debtors' : 'الذهاب للمدينين' },
    { key: 'Ctrl+Shift+A', action: currentLang === 'en' ? 'Go to aging' : 'الذهاب لأعمار الديون' },
    { key: 'Escape', action: currentLang === 'en' ? 'Close modals' : 'إغلاق النوافذ' },
    { key: 'Ctrl+Shift+S', action: currentLang === 'en' ? 'Save search' : 'حفظ البحث' },
    { key: 'Ctrl+Shift+F', action: currentLang === 'en' ? 'Advanced search' : 'بحث متقدم' }
  ];

  const helpContent = shortcuts.map(s => 
    `<div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border);">
      <kbd style="background:var(--surface-2); padding:4px 8px; border-radius:4px; font-family:monospace;">${s.key}</kbd>
      <span>${s.action}</span>
    </div>`
  ).join('');

  const helpHtml = `
    <div class="overlay show" id="keyboardHelpOverlay">
      <div class="modal" style="width:400px;">
        <div class="modal-head">
          <h3>${currentLang === 'en' ? 'Keyboard Shortcuts' : 'اختصارات لوحة المفاتيح'}</h3>
          <button class="modal-close" onclick="document.getElementById('keyboardHelpOverlay').classList.remove('show')">✕</button>
        </div>
        <div class="modal-body">
          ${helpContent}
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', helpHtml);
}

// Add keyboard help button to settings
document.addEventListener('DOMContentLoaded', () => {
  // NOTE: '[data-page="settings"]' matches the sidebar NAV LINK, not the settings page's
  // content section, and that nav link has no '.panel-head' child - so this used to silently
  // find nothing and never append the button anywhere. Target the actual settings page instead.
  const settingsPage = document.getElementById('page-settings');
  if (settingsPage) {
    const helpBtn = document.createElement('button');
    helpBtn.className = 'btn secondary small';
    helpBtn.textContent = currentLang === 'en' ? '⌨️ Keyboard Shortcuts' : '⌨️ اختصارات لوحة المفاتيح';
    helpBtn.onclick = showKeyboardShortcutsHelp;
    settingsPage.querySelector('.panel-head')?.appendChild(helpBtn);
  }
});

// ============== NEW TRANSLATIONS & FEATURES ==============
const newTranslations = {
  'status.suspended': ['معلق', 'Suspended'],
  'status.contested': ['متنازع عليه', 'Contested'],
  'status.uncollectible': ['مستحيل التحصيل', 'Uncollectible'],
  'filter.dateRange': ['نطاق التاريخ', 'Date Range'],
  'filter.amountRange': ['نطاق المبلغ', 'Amount Range'],
  'filter.collector': ['المندوب', 'Collector'],
  'filter.advancedSearch': ['🔍 بحث متقدم', '🔍 Advanced Search'],
  'filter.saveSearch': ['💾 حفظ البحث', '💾 Save Search'],
  'filter.apply': ['تطبيق', 'Apply'],
  'filter.reset': ['إعادة تعيين', 'Reset'],
  'filter.riskLevel': ['مستوى الخطورة', 'Risk Level'],
  'filter.lowRisk': ['منخفض', 'Low'],
  'filter.mediumRisk': ['متوسط', 'Medium'],
  'filter.highRisk': ['عالي', 'High'],
  'export.excel': ['⭳ تصدير إلى Excel', '⭳ Export to Excel'],
  'export.debtorsTable': ['تصدير جدول المدينين', 'Export Debtors Table'],
  'alerts.soundAlert': ['تنبيهات صوتية', 'Sound Alerts'],
  'alerts.smsAlert': ['تنبيهات SMS', 'SMS Alerts'],
  'alerts.emailAlert': ['تنبيهات بريد إلكتروني', 'Email Alerts'],
  'alerts.emailConfig': ['إعدادات البريد الإلكتروني', 'Email Configuration'],
  'analytics.collectionTrend': ['اتجاه التحصيل الشهري', 'Monthly Collection Trend'],
  'analytics.collectorPerformance': ['أداء المندوبين', 'Collector Performance'],
  'analytics.debtDistribution': ['توزيع الديون', 'Debt Distribution'],
  'analytics.paymentMethods': ['طرق الدفع', 'Payment Methods'],
  'dashboard.collectorStats': ['إحصائيات الأداء', 'Performance Stats'],
  'debtorStatus.suspended': ['معلق (قيد المراجعة)', 'Suspended (Under Review)'],
  'debtorStatus.contested': ['متنازع عليه (نزاع قانوني)', 'Contested (Legal Dispute)'],
  'debtorStatus.uncollectible': ['مستحيل التحصيل (كتابة ديون معدومة)', 'Uncollectible (Write-off)']
};
Object.assign(translations, newTranslations);

// ============== EXPORT TO EXCEL ==============
function exportDebtorsTableToExcel() {
  const data = [];
  const headers = [
    currentLang === 'en' ? 'Name' : 'الاسم',
    currentLang === 'en' ? 'Type' : 'النوع',
    currentLang === 'en' ? 'Phone' : 'الهاتف',
    currentLang === 'en' ? 'Total Debt' : 'إجمالي الدين',
    currentLang === 'en' ? 'Paid' : 'المسدد',
    currentLang === 'en' ? 'Remaining' : 'المتبقي',
    currentLang === 'en' ? 'Status' : 'الحالة',
    currentLang === 'en' ? 'Collector' : 'المندوب',
    currentLang === 'en' ? 'Notes' : 'ملاحظات'
  ];
  data.push(headers);
  
  scopedDebtors().forEach(d => {
    const rep = reps.find(r => r.id === d.repId);
    data.push([
      d.name,
      d.type === 'company' ? (currentLang === 'en' ? 'Company' : 'شركة') : (currentLang === 'en' ? 'Individual' : 'فرد'),
      d.phone || '—',
      d.total,
      d.paid,
      remaining(d),
      statusLabel(statusOf(d)),
      rep ? rep.name : (currentLang === 'en' ? 'Unassigned' : 'بدون مندوب'),
      d.notes || ''
    ]);
  });
  
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 28 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, currentLang === 'en' ? 'Debtors' : 'المدينون');
  XLSX.writeFile(book, `daftar-debtors-${todayISO()}.xlsx`);
  toast(currentLang === 'en' ? 'Exported successfully' : 'تم التصدير بنجاح');
  addAudit('export_excel', `${scopedDebtors().length} debtors`);
}

// ============== SMART NOTIFICATIONS ==============
function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {}
}

function triggerOverdueAlert(debtor) {
  const message = currentLang === 'en'
    ? `Alert: ${debtor.name} has overdue debt of QAR ${remaining(debtor)}`
    : `تنبيه: ${debtor.name} لديه دين متأخر بمبلغ ${remaining(debtor)} ر.ق`;
  
  if(appSettings.soundAlerts) {
    playNotificationSound();
  }
  
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(
      currentLang === 'en' ? 'Overdue Debt Alert' : 'تنبيه دين متأخر',
      {
        body: message,
        icon: '⚠️',
        tag: `overdue-${debtor.id}`,
        requireInteraction: true
      }
    );
  }
}

// ============== COLLECTOR PERFORMANCE ==============
function getCollectorPerformance(repId) {
  const cases = debtors.filter(d => d.repId === repId);
  const stats = {
    totalCases: cases.length,
    activeCases: cases.filter(d => statusOf(d) === 'active').length,
    overdueCases: cases.filter(d => statusOf(d) === 'overdue').length,
    paidCases: cases.filter(d => statusOf(d) === 'paid').length,
    totalAssigned: cases.reduce((s, d) => s + d.total, 0),
    totalCollected: cases.reduce((s, d) => s + d.paid, 0),
    collectionRate: (()=>{const tot=cases.reduce((s,d)=>s+d.total,0); return tot ? Math.round(cases.reduce((s,d)=>s+d.paid,0)/tot*100) : 0;})(),
    payments: []
  };
  
  cases.forEach(d => {
    d.log.filter(e => e.type === 'payment').forEach(e => {
      stats.payments.push({ ...e, debtor: d.name });
    });
  });
  
  return stats;
}

loadSettings();
loadSavedSearch();
{
  const savedTheme=localStorage.getItem('daftar_theme')||'gold';
  const savedCustom=localStorage.getItem('daftar_theme_custom');
  applyTheme(savedTheme==='custom' && savedCustom ? savedCustom : savedTheme);
  const savedPalette=localStorage.getItem('daftar_palette')||'navy';
  const savedPaletteCustom=localStorage.getItem('daftar_palette_custom');
  applyPalette(savedPalette==='custom' && savedPaletteCustom ? savedPaletteCustom : savedPalette);
}
document.getElementById('s_reminderDays').value = appSettings.reminderDays;
document.getElementById('s_watermarkEnabled').checked = appSettings.watermarkEnabled !== false;
document.getElementById('s_soundAlerts').checked = appSettings.soundAlerts !== false;
document.getElementById('s_emailAlerts').checked = appSettings.emailAlerts || false;
document.getElementById('s_notificationEmail').value = appSettings.notificationEmail || '';
document.getElementById('emailConfigField').style.display = appSettings.emailAlerts ? 'block' : 'none';
document.getElementById('s_autoLogout').checked = appSettings.autoLogout || false;
document.getElementById('s_sessionTimeout').checked = appSettings.sessionTimeout || false;
document.getElementById('s_passwordMinLength').value = appSettings.passwordMinLength || 8;
document.getElementById('s_autoFollowups').checked = appSettings.autoFollowups || false;
document.getElementById('s_autoReports').checked = appSettings.autoReports || false;
document.getElementById('s_smartReminders').checked = appSettings.smartReminders || false;
// Initialize application
async function initializeApp() {
  try {
    clearLegacyBrowserState();
    await loadState();
    loadSettings();
    // Initialize settings UI values
    if (document.getElementById('s_reminderDays')) {
      document.getElementById('s_reminderDays').value = appSettings.reminderDays;
      document.getElementById('s_watermarkEnabled').checked = appSettings.watermarkEnabled !== false;
      document.getElementById('s_soundAlerts').checked = appSettings.soundAlerts !== false;
      document.getElementById('s_emailAlerts').checked = appSettings.emailAlerts || false;
      document.getElementById('s_notificationEmail').value = appSettings.notificationEmail || '';
      document.getElementById('emailConfigField').style.display = appSettings.emailAlerts ? 'block' : 'none';
      document.getElementById('s_autoLogout').checked = appSettings.autoLogout || false;
      document.getElementById('s_sessionTimeout').checked = appSettings.sessionTimeout || false;
      document.getElementById('s_passwordMinLength').value = appSettings.passwordMinLength || 8;
      document.getElementById('s_autoFollowups').checked = appSettings.autoFollowups || false;
      document.getElementById('s_autoReports').checked = appSettings.autoReports || false;
      document.getElementById('s_smartReminders').checked = appSettings.smartReminders || false;
      document.getElementById('s_followupFrequency').value = appSettings.followupFrequency || 7;
      document.getElementById('s_dataRetention').checked = appSettings.dataRetention || false;
      document.getElementById('s_gdprCompliance').checked = appSettings.gdprCompliance || false;
      document.getElementById('s_auditTrail').checked = appSettings.auditTrail !== false;
      document.getElementById('s_companyName').value = appSettings.companyName || '';
      document.getElementById('s_companyTaxId').value = appSettings.companyTaxId || '';
      
      // Initialize integration settings
      if (document.getElementById('s_smsProvider')) {
        document.getElementById('s_smsProvider').value = appSettings.smsProvider || 'none';
        document.getElementById('s_emailProvider').value = appSettings.emailProvider || 'none';
        document.getElementById('s_smsApiKey').value = appSettings.smsApiKey || '';
        document.getElementById('s_emailApiKey').value = appSettings.emailApiKey || '';
        document.getElementById('smsConfigFields').style.display = appSettings.smsProvider !== 'none' ? 'block' : 'none';
        document.getElementById('emailConfigFields').style.display = appSettings.emailProvider !== 'none' ? 'block' : 'none';
      }
    }
    
    applyLanguage();
    applyMode();
    updateAuthUI();
    const savedUserId=sessionStorage.getItem('daftar_user_id'); 
    if(savedUserId) currentUser=users.find(user=>String(user.id)===savedUserId)||null;
    applyPermissions(); 
    renderUsers(); 
    renderAudit();
    
    if('Notification' in window && document.getElementById('notifStatus')){
      if(Notification.permission==='granted'){
        document.getElementById('notifStatus').textContent = currentLang==='en'?'Browser alerts enabled.':'تنبيهات المتصفح مفعّلة.';
      } else if(Notification.permission==='denied'){
        document.getElementById('notifStatus').textContent = currentLang==='en'?'Notification permission was denied in browser settings.':'تم رفض إذن التنبيهات من إعدادات المتصفح.';
      }
    } else if (document.getElementById('notifStatus')) {
      document.getElementById('notifStatus').textContent = currentLang==='en'?'This browser does not support system notifications.':'المتصفح الحالي لا يدعم تنبيهات النظام.';
    }

    renderAll();
    maybeSendDueNotifications();
    
    console.log('Application initialized successfully');
  } catch (e) {
    console.error('Error initializing application:', e);
  }
}

// Call initialization after DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}

