/* Self-check: `node validator.test.js` (no framework). Asserts the ruleset
 * fires on the mistakes the MyInvois portal actually rejects. */
const assert = require("assert");
const { validate } = require("./validator");

const v = (x) => [{ _: x }];                       // wrap a basic value
const tin = (id) => ({ ID: [{ _: id, schemeID: "TIN" }] });
const reg = (id, scheme) => ({ ID: [{ _: id, schemeID: scheme }] });

function party(name, tinId, scheme, regId, extra = {}) {
  return [{ Party: [Object.assign({
    PartyLegalEntity: [{ RegistrationName: v(name) }],
    PartyIdentification: [tin(tinId), reg(regId, scheme)],
    PostalAddress: [{ CityName: v("Kuala Lumpur"), Country: [{ IdentificationCode: v("MYS") }] }],
  }, extra)] }];
}

function goodInvoice(over = {}) {
  return {
    _D: "urn:...:Invoice-2", _A: "urn:...:CAC-2", _B: "urn:...:CBC-2",
    Invoice: [Object.assign({
      ID: v("INV-001"),
      IssueDate: v("2026-06-20"),
      IssueTime: v("10:30:00Z"),
      InvoiceTypeCode: [{ _: "01", listVersionID: "1.1" }],
      DocumentCurrencyCode: v("MYR"),
      Signature: [{ ID: v("sig") }],
      AccountingSupplierParty: party("Acme Sdn Bhd", "C12345678901", "BRN", "201901000005", {
        IndustryClassificationCode: [{ _: "62010", name: "Computer programming" }],
      }),
      AccountingCustomerParty: party("Ali bin Abu", "IG12345678902", "NRIC", "900101015523"),
      InvoiceLine: [{
        Item: [{ Description: v("Consulting") }],
        LineExtensionAmount: [{ _: 1000, currencyID: "MYR" }],
      }],
      TaxTotal: [{ TaxAmount: [{ _: 0, currencyID: "MYR" }] }],
      LegalMonetaryTotal: [{
        TaxExclusiveAmount: [{ _: 1000, currencyID: "MYR" }],
        TaxInclusiveAmount: [{ _: 1000, currencyID: "MYR" }],
        PayableAmount: [{ _: 1000, currencyID: "MYR" }],
      }],
    }, over)],
  };
}

// 1. a well-formed invoice passes (warnings tolerated, zero hard errors)
let r = validate(goodInvoice());
assert.strictEqual(r.ok, true, "good invoice should pass; got: " + JSON.stringify(r.issues));

// 2. "RM" instead of "MYR" is rejected
r = validate(goodInvoice({ DocumentCurrencyCode: v("RM") }));
assert.ok(r.issues.some((i) => /MYR/.test(i.message) && i.severity === "error"), "RM->MYR not caught");

// 3. missing buyer TIN is rejected
const noTin = goodInvoice();
noTin.Invoice[0].AccountingCustomerParty[0].Party[0].PartyIdentification = [reg("900101015523", "NRIC")];
r = validate(noTin);
assert.ok(r.issues.some((i) => /TIN is required/.test(i.message)), "missing TIN not caught");

// 4. unwrapped field (bare value, the #1 mistake) is rejected
r = validate(goodInvoice({ ID: "INV-001" }));
assert.ok(r.issues.some((i) => /wrapped array/.test(i.message)), "unwrapped field not caught");

// 5. bad date format rejected
r = validate(goodInvoice({ IssueDate: v("20/06/2026") }));
assert.ok(r.issues.some((i) => /YYYY-MM-DD/.test(i.message)), "bad date not caught");

// 6. consolidated (general-public TIN) over RM10k rejected
r = validate(goodInvoice({
  AccountingCustomerParty: party("General Public", "EI00000000010", "BRN", "NA"),
  LegalMonetaryTotal: [{
    TaxExclusiveAmount: [{ _: 15000, currencyID: "MYR" }],
    TaxInclusiveAmount: [{ _: 15000, currencyID: "MYR" }],
    PayableAmount: [{ _: 15000, currencyID: "MYR" }],
  }],
}));
assert.ok(r.issues.some((i) => /RM10,000/.test(i.message)), "consolidated >10k not caught");

// 7. garbage JSON string handled
r = validate("{ not json ");
assert.strictEqual(r.ok, false);
assert.ok(/Not valid JSON/.test(r.issues[0].message));

// 8. wrong currencyID on a line (mismatch) rejected
r = validate(goodInvoice({
  InvoiceLine: [{ Item: [{ Description: v("X") }], LineExtensionAmount: [{ _: 10, currencyID: "USD" }] }],
}));
assert.ok(r.issues.some((i) => /does not match DocumentCurrencyCode/.test(i.message)), "currency mismatch not caught");

console.log("All validator self-checks passed ✓");
