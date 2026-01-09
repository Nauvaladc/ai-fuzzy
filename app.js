const LABELS = ["Low", "Med", "High"];
const CONSEQUENTS = ["Layak", "Tidak"];
const STORAGE_KEY = "rules_tsukamoto_credit";

const elements = {
  modeToggle: document.getElementById("modeToggle"),
  adminTabButton: document.getElementById("adminTabButton"),
  tabButtons: document.querySelectorAll(".tab-button"),
  tabContents: document.querySelectorAll(".tab-content"),
  creditForm: document.getElementById("creditForm"),
  incomeInput: document.getElementById("incomeInput"),
  loanInput: document.getElementById("loanInput"),
  tenorInput: document.getElementById("tenorInput"),
  collateralInput: document.getElementById("collateralInput"),
  ratioValue: document.getElementById("ratioValue"),
  coverageValue: document.getElementById("coverageValue"),
  scoreValue: document.getElementById("scoreValue"),
  decisionValue: document.getElementById("decisionValue"),
  ruleCount: document.getElementById("ruleCount"),
  rulesTable: document.getElementById("rulesTable"),
  addRuleBtn: document.getElementById("addRuleBtn"),
  resetRulesBtn: document.getElementById("resetRulesBtn")
};

const defaultRules = generateDefaultRules();
let rules = loadRules();

function tri(x, a, b, c) {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
}

function trap(x, a, b, c, d) {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
}

function getIncomeMembership(x) {
  return {
    Low: trap(x, 0, 0, 3, 6),
    Med: tri(x, 4, 8, 12),
    High: trap(x, 10, 14, 20, 20)
  };
}

function getRatioMembership(x) {
  return {
    Low: trap(x, 0, 0, 15, 25),
    Med: tri(x, 20, 35, 50),
    High: trap(x, 45, 60, 200, 200)
  };
}

function getCoverageMembership(x) {
  return {
    Low: trap(x, 0, 0, 70, 90),
    Med: tri(x, 80, 110, 140),
    High: trap(x, 130, 160, 200, 200)
  };
}

function generateDefaultRules() {
  const generated = [];
  LABELS.forEach((income) => {
    LABELS.forEach((ratio) => {
      LABELS.forEach((coverage) => {
        let consequent = "Layak";
        if (ratio === "High") {
          consequent = "Tidak";
        } else if (income === "Low" && ratio !== "Low") {
          consequent = "Tidak";
        } else if (coverage === "Low" && ratio !== "Low") {
          consequent = "Tidak";
        }
        generated.push({
          if: { income, ratio, coverage },
          then: consequent
        });
      });
    });
  });
  return generated;
}

function loadRules() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    return structuredClone(defaultRules);
  }
  try {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return structuredClone(defaultRules);
    }
    return parsed;
  } catch (error) {
    console.warn("Gagal membaca rules dari localStorage", error);
    return structuredClone(defaultRules);
  }
}

function saveRules() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  updateRuleCount();
}

function updateRuleCount() {
  elements.ruleCount.textContent = `Rule aktif: ${rules.length}`;
}

function setActiveTab(tabName) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  elements.tabContents.forEach((content) => {
    content.classList.toggle("active", content.id === `tab-${tabName}`);
  });
}

function toggleAdminMode(enabled) {
  elements.adminTabButton.style.display = enabled ? "inline-flex" : "none";
  if (!enabled) {
    setActiveTab("customer");
  }
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function computeTsukamoto({ income, loan, tenor, collateral }) {
  const ratio = tenor > 0 && income > 0 ? ((loan / tenor) / income) * 100 : 0;
  const coverage = loan > 0 ? (collateral / loan) * 100 : 0;

  const incomeMembership = getIncomeMembership(income);
  const ratioMembership = getRatioMembership(ratio);
  const coverageMembership = getCoverageMembership(coverage);

  let sumAlpha = 0;
  let sumAlphaZ = 0;

  rules.forEach((rule) => {
    const alpha = Math.min(
      incomeMembership[rule.if.income] ?? 0,
      ratioMembership[rule.if.ratio] ?? 0,
      coverageMembership[rule.if.coverage] ?? 0
    );

    if (alpha <= 0) return;

    let z = 0;
    if (rule.then === "Layak") {
      z = 64 + 36 * alpha;
    } else {
      z = 64 * (1 - alpha);
    }
    sumAlpha += alpha;
    sumAlphaZ += alpha * z;
  });

  const score = sumAlpha === 0 ? 0 : sumAlphaZ / sumAlpha;
  const decision = score >= 64 ? "Layak" : "Tidak Layak";

  return { ratio, coverage, score, decision };
}

function renderRulesTable() {
  elements.rulesTable.innerHTML = "";
  rules.forEach((rule, index) => {
    const row = document.createElement("tr");

    const incomeCell = document.createElement("td");
    incomeCell.appendChild(createSelect("income", rule.if.income, index));

    const ratioCell = document.createElement("td");
    ratioCell.appendChild(createSelect("ratio", rule.if.ratio, index));

    const coverageCell = document.createElement("td");
    coverageCell.appendChild(createSelect("coverage", rule.if.coverage, index));

    const thenCell = document.createElement("td");
    thenCell.appendChild(createSelect("then", rule.then, index, CONSEQUENTS));

    const actionCell = document.createElement("td");
    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Hapus";
    deleteBtn.className = "ghost";
    deleteBtn.type = "button";
    deleteBtn.addEventListener("click", () => {
      rules.splice(index, 1);
      saveRules();
      renderRulesTable();
    });
    actionCell.appendChild(deleteBtn);

    row.appendChild(incomeCell);
    row.appendChild(ratioCell);
    row.appendChild(coverageCell);
    row.appendChild(thenCell);
    row.appendChild(actionCell);

    elements.rulesTable.appendChild(row);
  });
}

function createSelect(field, selectedValue, index, options = LABELS) {
  const select = document.createElement("select");
  options.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    if (label === selectedValue) option.selected = true;
    select.appendChild(option);
  });

  select.addEventListener("change", (event) => {
    const value = event.target.value;
    if (field === "then") {
      rules[index].then = value;
    } else {
      rules[index].if[field] = value;
    }
    saveRules();
  });

  return select;
}

function addRule() {
  rules.push({
    if: { income: "Med", ratio: "Med", coverage: "Med" },
    then: "Layak"
  });
  saveRules();
  renderRulesTable();
}

function resetRules() {
  rules = structuredClone(defaultRules);
  saveRules();
  renderRulesTable();
}

function handleSubmit(event) {
  event.preventDefault();
  const income = parseFloat(elements.incomeInput.value);
  const loan = parseFloat(elements.loanInput.value);
  const tenor = parseFloat(elements.tenorInput.value);
  const collateral = parseFloat(elements.collateralInput.value);

  const result = computeTsukamoto({ income, loan, tenor, collateral });
  elements.ratioValue.textContent = formatNumber(result.ratio);
  elements.coverageValue.textContent = formatNumber(result.coverage);
  elements.scoreValue.textContent = formatNumber(result.score);
  elements.decisionValue.textContent = result.decision;
}

function initTabs() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.dataset.tab;
      if (tabName === "admin" && elements.adminTabButton.style.display === "none") {
        return;
      }
      setActiveTab(tabName);
    });
  });
}

function init() {
  initTabs();
  toggleAdminMode(false);
  updateRuleCount();
  renderRulesTable();

  elements.modeToggle.addEventListener("change", (event) => {
    toggleAdminMode(event.target.checked);
  });

  elements.creditForm.addEventListener("submit", handleSubmit);
  elements.addRuleBtn.addEventListener("click", addRule);
  elements.resetRulesBtn.addEventListener("click", resetRules);
}

init();
