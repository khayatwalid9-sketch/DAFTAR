const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
function grabFn(name){ const i = src.indexOf('function ' + name + '('); let d = 0; for(let k = src.indexOf('{', i); k < src.length; k++){ if(src[k] === '{') d++; else if(src[k] === '}'){ d--; if(!d) return src.slice(i, k + 1); } } }
const parse = new Function(grabFn('toISODate') + '\n' + grabFn('parseQuotationFromText') + '\nreturn parseQuotationFromText;')();
const F = {"ultracrete": "Page 1 of 6\nQUOTATION\nCompany Name\nL & A DEVELOPERS\nContact : Mr. Suneer Muhammedali\nAddress : PO Box : , Doha , Qatar\nTelephone: +974 50751577\nEmail : kolamban@gmail.com\nSales In-Charge\nMr. Walid (+974- 3377 4995)\nDate Quote No. Validity\n15-11-2026 QTN-2026-00984-1 15 Days\nProject Name and Location :\nPrecast Reinforced Concrete Boundary Wall\nInitial Enquiry Date : 2026-10-28\nProject Status ✔ Tender Job In Hand\nSL ITEM DESCRIPTION QTY UOM RATE PRICE (QAR)\n1 Supply and Installation of Precast reinforced concrete boundary wall of typical\ncenter to center length of 3300mm and detailed as follows;\nEccentric Footing of size 1600 x 1300 x 250mm thick cast in single unit with column\nof size 350 x 350 x 3150mm high from top of footing; top level of 2500mm from FGL\nHalf octagonal shaped beam of size 150/300 x 300mm depth\nPanel of size 125mm thick x 1650mm high, without any decorative pattern; top level\nof 1800 from FGL.\nPVC conduit included but all electrical fixtures to be supplied and installed by others,\nall concrete edges with chamfer, concrete surfaces below ground applied with two (2)\ncoats of emulsified bituminous primer but gates,steel grills, painting and sealant\nworks are not included .\n446.0 LM 775.00 345,650.00\nIN WORDS:QAR Three Hundred And Forty Five Thousand, Six Hundred And\nFifty only.\nTOTAL QAR : 345,650.00\n\nThis quotation is valid for 15 days. Payment terms: 50% advance. consultant requirement\nWe hope above will meet with your requirements. Assuring you of our best attention at all the time.\nThanks & Regards,\nSales Manager\n", "invoice": "TAX INVOICE\nInvoice No: INV-2026-0045\nTo: Al Rafee Trading Co WLL\nAttn: Eng. Ahmed Hassan\nMobile: 5566 7788\nDate: 03/11/2026\nTotal Amount QAR 12,500.00\nThank you for your attention at all times.\nPayment within 30 days.\n", "arabic": "عرض سعر\nرقم العرض: Q-2026-114\nالسادة: شركة النجمة للمقاولات\nعناية: المهندس خالد سعيد\nهاتف: 33445566\nالتاريخ: 2026-11-10\nالإجمالي: 8,400\n", "merged": "QUOTATION\nCompany Name Date Quote No. Validity\nKAMPSRA TRADING & SERVICES 02-11-2026 QTN-2026-00931 30 Days\nContact: Ms. Rima\nProject Status Tender ✔ Job In Hand\nTOTAL QAR : 25,730.00\n"};

test('UltraCrete quotation PDF: contact is the client contact, not a phrase from the closing line', () => {
  const r = parse(F.ultracrete, 'x.pdf');
  assert.equal(r.contactPerson, 'Mr. Suneer Muhammedali');
  assert.equal(r.companyName, 'L & A DEVELOPERS');
  assert.equal(r.quotationNo, 'QTN-2026-00984-1');
  assert.equal(r.date, '2026-11-15');          // quotation date, not the enquiry date
  assert.equal(r.nextFollowup, '2026-11-30');  // + 15 days validity
  assert.equal(r.amount, 345650);
  assert.equal(r.projectStatus, 'tender');
  assert.equal(r.companyScope, 'developer');   // not "consultant" from the T&C text
  assert.equal(r.subject, 'quoteFollowup');
  assert.equal(r.status, 'submitted');
  assert.match(r.requirement, /^Precast Reinforced Concrete Boundary Wall/);
  assert.deepEqual(r.lowConf, []);               // every field came from a clear label
});
test('guesses are reported as low confidence', () => {
  const r = parse('Some Co WLL\n12,000', 'scan.jpg');
  for (const id of ['q_contact','q_quotationNo','q_date','q_email']) assert.ok(r.lowConf.includes(id), id);
});
test('invoice: invoice number is not taken as a quotation number; subject is payment', () => {
  const r = parse(F.invoice, 'x.pdf');
  assert.equal(r.invoiceNo, 'INV-2026-0045'); assert.equal(r.quotationNo, '');
  assert.equal(r.subject, 'payment'); assert.equal(r.contactPerson, 'Eng. Ahmed Hassan');
});
test('Arabic labels', () => {
  const r = parse(F.arabic, 'x.pdf');
  assert.equal(r.contactPerson, 'المهندس خالد سعيد'); assert.equal(r.quotationNo, 'Q-2026-114'); assert.equal(r.amount, 8400);
});
test('values row merged with the company name is cleaned; tick mark picks Job In Hand', () => {
  const r = parse(F.merged, 'x.pdf');
  assert.equal(r.companyName, 'KAMPSRA TRADING & SERVICES'); assert.equal(r.projectStatus, 'jobInHand');
});
