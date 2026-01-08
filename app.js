const RULE_STORAGE_KEY = "rules_tsukamoto_credit";
const LABELS = ["Low", "Med", "High"];
const CONSEQUENTS = ["Layak", "Tidak"];

const elements = {
  modeToggle: document.getElementById("modeToggle"),
  tabButtons: document.querySelectorAll(".tab-button"),
  adminTabButton: document.getElementById("adminTabButton"),
  customerTab: document.getElementById("customerTab"),
  adminTab: document.getElementById("adminTab"),
  creditForm: document.getElementById("creditForm"),
  incomeInput: document.getElementById("incomeInput"),
  loanInput: document.getElementById("loanInput"),
  tenorInput: document.getElementById("tenorInput"),
  collateralInput: document.getElementById("collateralInput"),
  ratioValue: document.getElementById("ratioValue"),
  coverageValue: document.getElementById("coverageValue"),
  scoreValue: document.getElementById("scoreValue"),
  decisionValue: document.getElementById("decisionValue"),
  rulesTableBody: document.getElementById("rulesTableBody"),
  addRuleButton: document.getElementById("addRuleButton"),
  resetRuleButton: document.getElementById("resetRuleButton"),
};

let rules = [];

const tri = (x, a, b, c) => {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
};

const trap = (x, a, b, c, d) => {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
};

const buildDefaultRules = () => {
  const generated = [];
  LABELS.forEach((income) => {
    LABELS.forEach((ratio) => {
      LABELS.forEach((coverage) => {
        let decision = "Layak";
        if (ratio === "High") {
          decision = "Tidak";
        } else if (income === "Low" && ratio !== "Low") {
          decision = "Tidak";
        } else if (coverage === "Low" && ratio !== "Low") {
          decision = "Tidak";
        }
        generated.push({
          if: { income, ratio, coverage },
          then: decision,
        });
      });
    });
  });
  return generated;
};

const loadRules = () => {
  const stored = localStorage.getItem(RULE_STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length) {
        rules = parsed;
        return;
      }
    } catch (error) {
      console.warn("Gagal parse rules dari localStorage", error);
    }
  }
  rules = buildDefaultRules();
};

const persistRules = () => {
  localStorage.setItem(RULE_STORAGE_KEY, JSON.stringify(rules));
};

const toggleAdminMode = (enabled) => {
  elements.adminTabButton.style.display = enabled ? "inline-flex" : "none";
  if (!enabled) {
    showTab("customerTab");
  }
};

const showTab = (tabId) => {
  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("active", isActive);
  });
  document.querySelectorAll(".tab-content").forEach((section) => {
    section.classList.toggle("active", section.id === tabId);
  });
};

const createSelect = (options, value, onChange) => {
  const select = document.createElement("select");
  options.forEach((label) => {
    const option = document.createElement("option");
    option.value = label;
    option.textContent = label;
    if (label === value) {
      option.selected = true;
    }
    select.appendChild(option);
  });
  select.addEventListener("change", (event) => {
    onChange(event.target.value);
  });
  return select;
};

const renderRulesTable = () => {
  elements.rulesTableBody.innerHTML = "";
  rules.forEach((rule, index) => {
    const row = document.createElement("tr");

    const incomeCell = document.createElement("td");
    incomeCell.appendChild(
      createSelect(LABELS, rule.if.income, (value) => {
        rule.if.income = value;
        persistRules();
      })
    );

    const ratioCell = document.createElement("td");
    ratioCell.appendChild(
      createSelect(LABELS, rule.if.ratio, (value) => {
        rule.if.ratio = value;
        persistRules();
      })
    );

    const coverageCell = document.createElement("td");
    coverageCell.appendChild(
      createSelect(LABELS, rule.if.coverage, (value) => {
        rule.if.coverage = value;
        persistRules();
      })
    );

    const consequentCell = document.createElement("td");
    consequentCell.appendChild(
      createSelect(CONSEQUENTS, rule.then, (value) => {
        rule.then = value;
        persistRules();
      })
    );

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Hapus";
    deleteButton.classList.add("secondary");
    deleteButton.addEventListener("click", () => {
      rules.splice(index, 1);
      persistRules();
      renderRulesTable();
    });
    actionCell.appendChild(deleteButton);

    row.appendChild(incomeCell);
    row.appendChild(ratioCell);
    row.appendChild(coverageCell);
    row.appendChild(consequentCell);
    row.appendChild(actionCell);

    elements.rulesTableBody.appendChild(row);
  });
};

const calculateMemberships = ({ income, ratio, coverage }) => ({
  income: {
    Low: trap(income, 0, 0, 3, 6),
    Med: tri(income, 4, 8, 12),
    High: trap(income, 10, 14, 20, 20),
  },
  ratio: {
    Low: trap(ratio, 0, 0, 15, 25),
    Med: tri(ratio, 20, 35, 50),
    High: trap(ratio, 45, 60, 200, 200),
  },
  coverage: {
    Low: trap(coverage, 0, 0, 70, 90),
    Med: tri(coverage, 80, 110, 140),
    High: trap(coverage, 130, 160, 200, 200),
  },
});

const calculateTsukamoto = (memberships) => {
  let sumAlphaZ = 0;
  let sumAlpha = 0;

  rules.forEach((rule) => {
    const alpha = Math.min(
      memberships.income[rule.if.income],
      memberships.ratio[rule.if.ratio],
      memberships.coverage[rule.if.coverage]
    );

    if (alpha <= 0) {
      return;
    }

    const z = rule.then === "Layak" ? 64 + 36 * alpha : 64 * (1 - alpha);
    sumAlphaZ += alpha * z;
    sumAlpha += alpha;
  });

  if (sumAlpha === 0) {
    return 0;
  }

  return sumAlphaZ / sumAlpha;
};

const handleSubmit = (event) => {
  event.preventDefault();
  const income = Number(elements.incomeInput.value);
  const loan = Number(elements.loanInput.value);
  const tenor = Number(elements.tenorInput.value);
  const collateral = Number(elements.collateralInput.value);

  const ratio = tenor === 0 || income === 0 ? 0 : ((loan / tenor) / income) * 100;
  const coverage = loan === 0 ? 0 : (collateral / loan) * 100;

  const memberships = calculateMemberships({ income, ratio, coverage });
  const zScore = calculateTsukamoto(memberships);
  const decision = zScore >= 64 ? "Layak" : "Tidak Layak";

  elements.ratioValue.textContent = ratio.toFixed(2);
  elements.coverageValue.textContent = coverage.toFixed(2);
  elements.scoreValue.textContent = zScore.toFixed(2);
  elements.decisionValue.textContent = decision;
};

const initTabs = () => {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showTab(button.dataset.tab);
    });
  });
};

const initAdmin = () => {
  elements.addRuleButton.addEventListener("click", () => {
    rules.push({
      if: { income: "Low", ratio: "Low", coverage: "Low" },
      then: "Layak",
    });
    persistRules();
    renderRulesTable();
  });

  elements.resetRuleButton.addEventListener("click", () => {
    rules = buildDefaultRules();
    persistRules();
    renderRulesTable();
  });
};

const initModeToggle = () => {
  elements.modeToggle.addEventListener("change", (event) => {
    const enabled = event.target.checked;
    toggleAdminMode(enabled);
  });
  toggleAdminMode(elements.modeToggle.checked);
};

const init = () => {
  loadRules();
  renderRulesTable();
  initTabs();
  initAdmin();
  initModeToggle();
  elements.creditForm.addEventListener("submit", handleSubmit);
};

init();
