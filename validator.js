/* MyInvois e-Invoice JSON validator — structural/format pre-flight check.
 *
 * Grounded in LHDN MyInvois SDK Invoice v1.1 field spec
 * (sdk.myinvois.hasil.gov.my/documents/invoice-v1-1, /signature-creation-json).
 *
 * Scope (deliberately honest): checks JSON shape, the wrapped UBL field format
 * (`"ID":[{"_":"..."}]`), presence of mandatory fields, and the format mistakes
 * the portal rejects silently (RM vs MYR, bad date/time, wrong currencyID, TIN
 * length, consolidated >RM10k). It does NOT verify digital signatures, do a live
 * TIN lookup, or replace the official portal validation.
 *
 * ponytail: one flat ruleset, no schema engine. A real JSON-Schema validator is
 * the upgrade path if rules outgrow this (~30 checks) — not before.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.MyInvoisValidator = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Common wrong currency codes people type -> the correct ISO 4217 code.
  const CURRENCY_FIXES = { RM: "MYR", US: "USD", USD$: "USD", SG: "SGD", "S$": "SGD", "£": "GBP", "€": "EUR" };
  const INVOICE_TYPE_CODES = ["01", "02", "03", "04", "11", "12", "13", "14"];
  const GENERAL_PUBLIC_TIN = "EI00000000010"; // consolidated / general public buyer
  const CONSOLIDATED_LIMIT = 10000; // post-Jan-2026: single txn > RM10k can't be consolidated

  const E = "error";   // will be rejected by the portal
  const W = "warning"; // likely a problem / best-practice
  const OK = "ok";

  // --- field accessors for the wrapped UBL-JSON shape -----------------------
  // basic value:  node.Field = [{ "_": value, ...attrs }]
  function basic(node, field) {
    const arr = node && node[field];
    if (arr === undefined) return undefined;
    if (!Array.isArray(arr)) return { __unwrapped: arr }; // user forgot the array wrap
    const first = arr[0];
    if (first && typeof first === "object" && "_" in first) return first._;
    return { __malformed: true };
  }
  function attr(node, field, name) {
    const arr = node && node[field];
    if (!Array.isArray(arr) || !arr[0]) return undefined;
    return arr[0][name];
  }
  // aggregate node: node.Field = [{ ...children }]
  function agg(node, field) {
    const arr = node && node[field];
    if (!Array.isArray(arr)) return undefined;
    return arr[0];
  }
  function aggList(node, field) {
    const arr = node && node[field];
    return Array.isArray(arr) ? arr : [];
  }

  function validate(input) {
    const issues = [];
    const add = (severity, path, message) => issues.push({ severity, path, message });

    // 1) parse -------------------------------------------------------------
    let doc;
    if (typeof input === "string") {
      try {
        doc = JSON.parse(input);
      } catch (err) {
        return finish([{ severity: E, path: "(root)", message: "Not valid JSON: " + err.message }]);
      }
    } else {
      doc = input;
    }
    if (!doc || typeof doc !== "object") {
      return finish([{ severity: E, path: "(root)", message: "Top level must be a JSON object." }]);
    }

    // 2) envelope ----------------------------------------------------------
    for (const ns of ["_D", "_A", "_B"]) {
      if (!doc[ns]) add(W, ns, "Missing namespace key \"" + ns + "\". MyInvois documents include _D/_A/_B URN namespace declarations.");
    }
    if (!Array.isArray(doc.Invoice) || doc.Invoice.length === 0) {
      add(E, "Invoice", "Missing \"Invoice\" array. The document must be { _D, _A, _B, \"Invoice\": [ { ... } ] }.");
      return finish(issues);
    }

    doc.Invoice.forEach((inv, i) => validateInvoice(inv, "Invoice[" + i + "]", add));
    return finish(issues);

    function finish(list) {
      const errors = list.filter((x) => x.severity === E).length;
      const warnings = list.filter((x) => x.severity === W).length;
      return {
        ok: errors === 0,
        errors,
        warnings,
        issues: list,
        summary: errors === 0
          ? (warnings === 0 ? "Structurally valid — no issues found." : "No blocking errors, but " + warnings + " warning(s) to review.")
          : errors + " error(s) the MyInvois portal would reject" + (warnings ? ", plus " + warnings + " warning(s)." : "."),
      };
    }
  }

  function validateInvoice(inv, p, add) {
    // catch the #1 mistake: fields not wrapped in an array
    const wrapErr = (field) => {
      const v = basic(inv, field);
      if (v && v.__unwrapped !== undefined)
        add(E, p + "." + field, "Field must be a wrapped array, e.g. \"" + field + "\": [{ \"_\": \"value\" }] — found a bare value instead.");
      return v;
    };

    // --- mandatory core fields -------------------------------------------
    requirePresent(inv, p, add, ["ID", "IssueDate", "IssueTime", "InvoiceTypeCode", "DocumentCurrencyCode"]);

    const id = wrapErr("ID");
    if (typeof id === "string" && id.length > 50) add(E, p + ".ID", "Invoice ID exceeds 50 characters.");

    const issueDate = wrapErr("IssueDate");
    if (typeof issueDate === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(issueDate))
      add(E, p + ".IssueDate", "IssueDate must be YYYY-MM-DD (ISO 8601). Got \"" + issueDate + "\".");

    const issueTime = wrapErr("IssueTime");
    if (typeof issueTime === "string" && !/^\d{2}:\d{2}:\d{2}Z$/.test(issueTime))
      add(E, p + ".IssueTime", "IssueTime must be HH:MM:SSZ in UTC (e.g. \"10:30:00Z\"). Got \"" + issueTime + "\".");

    const typeCode = wrapErr("InvoiceTypeCode");
    if (typeof typeCode === "string" && !INVOICE_TYPE_CODES.includes(typeCode))
      add(E, p + ".InvoiceTypeCode", "Unknown InvoiceTypeCode \"" + typeCode + "\". Expected one of " + INVOICE_TYPE_CODES.join(", ") + ".");
    const ver = attr(inv, "InvoiceTypeCode", "listVersionID");
    if (ver && ver !== "1.1")
      add(W, p + ".InvoiceTypeCode.listVersionID", "listVersionID is \"" + ver + "\"; v1.1 (signature-enabled) is current.");

    // --- currency ---------------------------------------------------------
    const cur = wrapErr("DocumentCurrencyCode");
    const docCurrency = typeof cur === "string" ? cur : null;
    if (typeof cur === "string") checkCurrency(cur, p + ".DocumentCurrencyCode", add);

    // --- parties ----------------------------------------------------------
    validateParty(agg(inv, "AccountingSupplierParty"), p + ".AccountingSupplierParty", add, true);
    const buyer = agg(inv, "AccountingCustomerParty");
    validateParty(buyer, p + ".AccountingCustomerParty", add, false);

    // --- lines ------------------------------------------------------------
    const lines = aggList(inv, "InvoiceLine");
    if (lines.length === 0) add(E, p + ".InvoiceLine", "At least one InvoiceLine is required.");
    let maxLineAmount = 0;
    lines.forEach((line, li) => {
      const lp = p + ".InvoiceLine[" + li + "]";
      const item = agg(line, "Item");
      if (!item || typeof basic(item, "Description") !== "string")
        add(E, lp + ".Item.Description", "Line item Description is required.");
      const lineAmt = num(basic(line, "LineExtensionAmount"));
      if (lineAmt === null) add(E, lp + ".LineExtensionAmount", "LineExtensionAmount is required (numeric).");
      else maxLineAmount = Math.max(maxLineAmount, lineAmt);
      // currencyID on the amount must match the document currency
      const lineCur = attr(line, "LineExtensionAmount", "currencyID");
      if (docCurrency && lineCur && lineCur !== docCurrency)
        add(E, lp + ".LineExtensionAmount.currencyID", "currencyID \"" + lineCur + "\" does not match DocumentCurrencyCode \"" + docCurrency + "\".");
    });

    // --- tax + totals -----------------------------------------------------
    if (!agg(inv, "TaxTotal")) add(E, p + ".TaxTotal", "TaxTotal is required (use TaxAmount 0 with category code \"E\"/\"06\" if exempt/not applicable).");
    const totals = agg(inv, "LegalMonetaryTotal");
    if (!totals) add(E, p + ".LegalMonetaryTotal", "LegalMonetaryTotal is required.");
    else requirePresent(totals, p + ".LegalMonetaryTotal", add, ["TaxExclusiveAmount", "TaxInclusiveAmount", "PayableAmount"]);

    // --- signature (v1.1) -------------------------------------------------
    if (!agg(inv, "Signature") && !inv.UBLExtensions)
      add(W, p + ".Signature", "No Signature/UBLExtensions found. Invoice v1.1 requires a digital signature before submission (you may add it in a later signing step).");

    // --- consolidated > RM10k rule ---------------------------------------
    const buyerTin = buyer && tinOf(agg(buyer, "Party"));
    const payable = totals ? num(basic(totals, "PayableAmount")) : null;
    const biggest = Math.max(maxLineAmount, payable || 0);
    if (buyerTin === GENERAL_PUBLIC_TIN && biggest > CONSOLIDATED_LIMIT)
      add(E, p, "Consolidated / general-public invoice (buyer TIN " + GENERAL_PUBLIC_TIN + ") with an amount above RM" + CONSOLIDATED_LIMIT.toLocaleString() + ". Since Jan 2026 a single transaction over RM10,000 must be a normal e-invoice with the buyer's real details, not consolidated.");
  }

  function validateParty(partyWrap, p, add, isSupplier) {
    if (!partyWrap) { add(E, p, (isSupplier ? "Supplier" : "Buyer") + " party (" + p.split(".").pop() + ") is required."); return; }
    const party = agg(partyWrap, "Party");
    if (!party) { add(E, p + ".Party", "Party object is required."); return; }

    const legal = agg(party, "PartyLegalEntity");
    if (!legal || typeof basic(legal, "RegistrationName") !== "string")
      add(E, p + ".Party.PartyLegalEntity.RegistrationName", "Registered name is required.");

    const tin = tinOf(party);
    if (!tin) add(E, p + ".Party.PartyIdentification[TIN]", "TIN is required (schemeID \"TIN\").");
    else if (typeof tin === "string" && tin.replace(/\s/g, "").length !== 14)
      add(W, p + ".Party.PartyIdentification[TIN]", "TIN \"" + tin + "\" is not 14 characters — verify it (e.g. C1234567890123, IG / EI prefixes).");

    // at least one of BRN / NRIC / PASSPORT / ARMY
    const ids = idSchemes(party);
    const hasReg = ["BRN", "NRIC", "PASSPORT", "ARMY"].some((s) => ids.includes(s));
    if (!hasReg) add(E, p + ".Party.PartyIdentification", "A registration ID is required: BRN (company) or NRIC/PASSPORT/ARMY (individual).");

    if (isSupplier) {
      const msic = basic(party, "IndustryClassificationCode");
      if (typeof msic !== "string" || !/^\d{5}$/.test(msic))
        add(E, p + ".Party.IndustryClassificationCode", "Supplier MSIC code must be 5 digits.");
    }

    const addr = agg(party, "PostalAddress");
    if (!addr) add(E, p + ".Party.PostalAddress", "Postal address is required.");
    else {
      if (typeof basic(addr, "CityName") !== "string") add(E, p + ".Party.PostalAddress.CityName", "CityName is required.");
      const country = agg(addr, "Country");
      const cc = country && basic(country, "IdentificationCode");
      if (typeof cc !== "string" || !/^[A-Z]{3}$/.test(cc))
        add(E, p + ".Party.PostalAddress.Country.IdentificationCode", "Country code must be a 3-letter ISO 3166-1 code (Malaysia = MYS).");
    }
  }

  // --- small helpers --------------------------------------------------------
  function tinOf(party) {
    for (const pi of aggList(party, "PartyIdentification")) {
      if (pi && pi.ID && Array.isArray(pi.ID) && pi.ID[0] && pi.ID[0].schemeID === "TIN") return pi.ID[0]._;
    }
    return null;
  }
  function idSchemes(party) {
    return aggList(party, "PartyIdentification")
      .map((pi) => (pi && pi.ID && pi.ID[0] && pi.ID[0].schemeID) || null)
      .filter(Boolean);
  }
  function checkCurrency(code, path, add) {
    if (CURRENCY_FIXES[code]) { add("error", path, "\"" + code + "\" is not a valid ISO 4217 code — use \"" + CURRENCY_FIXES[code] + "\"."); return; }
    if (!/^[A-Z]{3}$/.test(code)) add("error", path, "Currency must be a 3-letter ISO 4217 code (e.g. MYR). Got \"" + code + "\".");
  }
  function requirePresent(node, p, add, fields) {
    for (const f of fields) if (basic(node, f) === undefined && agg(node, f) === undefined)
      add("error", p + "." + f, "Mandatory field \"" + f + "\" is missing.");
  }
  function num(v) {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
    return null;
  }

  return { validate: validate };
});
