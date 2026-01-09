const LABELS = ["Low", "Med", "High"];
const STORAGE_KEY = "rules_tsukamoto_credit";

const defaultRules = () => {
  const rules = [];
  LABELS.forEach((income) => {
    LABELS.forEach((ratio) => {
      LABELS.forEach((coverage) => {
        let then = "Layak";
        if (ratio === "High") {
          then = "Tidak";
        } else if (income === "Low" && ratio !== "Low") {
          then = "Tidak";
        } else if (coverage === "Low" && ratio !== "Low") {
          then = "Tidak";
        }
        rules.push({
          if: { income, ratio, coverage },
          then,
        });
      });
    });
  });
  return rules;
};

const tri = (x, a, b, c) => {
  if (x <= a || x >= c) return 0;
  if (x === b) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (c - x) / (c - b);
};

const trap = (x, a, b, c, d) => {
  if (x <= a || x >= d) return 0;
  if (x >= b && x <= c) return 1;
  if (x > a && x < b) return (x - a) / (b - a);
  return (d - x) / (d - c);
};

const fuzzify = ({ income, ratio, coverage }) => ({
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

const tsukamoto = (inputs, rules) => {
  const memberships = fuzzify(inputs);
  let numerator = 0;
  let denominator = 0;

  rules.forEach((rule) => {
    const alpha = Math.min(
      memberships.income[rule.if.income],
      memberships.ratio[rule.if.ratio],
      memberships.coverage[rule.if.coverage]
    );

    if (alpha === 0) return;

    let z = 0;
    if (rule.then === "Layak") {
      z = 64 + 36 * alpha;
    } else {
      z = 64 * (1 - alpha);
    }
    numerator += alpha * z;
    denominator += alpha;
  });

  const score = denominator === 0 ? 0 : numerator / denominator;
  return {
    score,
    decision: score >= 64 ? "Layak" : "Tidak Layak",
  };
};

const loadRules = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultRules();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Invalid rules");
    return parsed;
  } catch (error) {
    return defaultRules();
  }
};

const saveRules = (rules) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
};

const state = {
  rules: loadRules(),
  mode: "basic",
};

const modeBasicButton = document.getElementById("modeBasic");
const modeAdminButton = document.getElementById("modeAdmin");
const tabButtons = document.querySelectorAll(".tab-button");
const tabCustomer = document.getElementById("tab-customer");
const tabAdmin = document.getElementById("tab-admin");

const ruleTable = document.getElementById("ruleTable");
const addRuleButton = document.getElementById("addRule");
const resetRuleButton = document.getElementById("resetRule");

const ratioValue = document.getElementById("ratioValue");
const coverageValue = document.getElementById("coverageValue");
const scoreValue = document.getElementById("scoreValue");
const decisionValue = document.getElementById("decisionValue");

const customerForm = document.getElementById("customerForm");

const setMode = (mode) => {
  state.mode = mode;
  const isAdmin = mode === "admin";
  modeBasicButton.classList.toggle("active", !isAdmin);
  modeAdminButton.classList.toggle("active", isAdmin);
  tabAdmin.classList.toggle("hidden", !isAdmin);
  tabButtons.forEach((button) => {
    if (button.dataset.tab === "admin") {
      button.classList.toggle("hidden", !isAdmin);
    }
  });
  if (!isAdmin) {
    setTab("customer");
  }
};

const setTab = (tabName) => {
  tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  tabCustomer.classList.toggle("active", tabName === "customer");
  tabAdmin.classList.toggle("active", tabName === "admin");
};

const createSelect = (value, options) => {
  const select = document.createElement("select");
  options.forEach((option) => {
    const opt = document.createElement("option");
    opt.value = option;
    opt.textContent = option;
    if (option === value) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
  return select;
};

const renderRules = () => {
  ruleTable.innerHTML = "";
  state.rules.forEach((rule, index) => {
    const row = document.createElement("tr");

    const incomeCell = document.createElement("td");
    const ratioCell = document.createElement("td");
    const coverageCell = document.createElement("td");
    const thenCell = document.createElement("td");
    const actionCell = document.createElement("td");

    const incomeSelect = createSelect(rule.if.income, LABELS);
    const ratioSelect = createSelect(rule.if.ratio, LABELS);
    const coverageSelect = createSelect(rule.if.coverage, LABELS);
    const thenSelect = createSelect(rule.then, ["Layak", "Tidak"]);

    incomeSelect.addEventListener("change", (event) => {
      rule.if.income = event.target.value;
      saveRules(state.rules);
    });
    ratioSelect.addEventListener("change", (event) => {
      rule.if.ratio = event.target.value;
      saveRules(state.rules);
    });
    coverageSelect.addEventListener("change", (event) => {
      rule.if.coverage = event.target.value;
      saveRules(state.rules);
    });
    thenSelect.addEventListener("change", (event) => {
      rule.then = event.target.value;
      saveRules(state.rules);
    });

    incomeCell.appendChild(incomeSelect);
    ratioCell.appendChild(ratioSelect);
    coverageCell.appendChild(coverageSelect);
    thenCell.appendChild(thenSelect);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "action-button";
    deleteButton.textContent = "Hapus";
    deleteButton.addEventListener("click", () => {
      state.rules.splice(index, 1);
      saveRules(state.rules);
      renderRules();
    });

    actionCell.appendChild(deleteButton);

    row.append(incomeCell, ratioCell, coverageCell, thenCell, actionCell);
    ruleTable.appendChild(row);
  });
};

const updateResultUI = (ratio, coverage, score, decision) => {
  ratioValue.textContent = `${ratio.toFixed(2)}%`;
  coverageValue.textContent = `${coverage.toFixed(2)}%`;
  scoreValue.textContent = score.toFixed(2);
  decisionValue.textContent = decision;
  decisionValue.classList.remove("good", "bad");
  decisionValue.classList.add(decision === "Layak" ? "good" : "bad");
};

modeBasicButton.addEventListener("click", () => setMode("basic"));
modeAdminButton.addEventListener("click", () => {
  setMode("admin");
  setTab("admin");
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.tab === "admin" && state.mode !== "admin") return;
    setTab(button.dataset.tab);
  });
});

addRuleButton.addEventListener("click", () => {
  state.rules.push({
    if: { income: "Low", ratio: "Low", coverage: "Low" },
    then: "Layak",
  });
  saveRules(state.rules);
  renderRules();
});

resetRuleButton.addEventListener("click", () => {
  state.rules = defaultRules();
  saveRules(state.rules);
  renderRules();
});

customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const income = parseFloat(document.getElementById("income").value) || 0;
  const loan = parseFloat(document.getElementById("loan").value) || 0;
  const tenor = parseFloat(document.getElementById("tenor").value) || 0;
  const collateral =
    parseFloat(document.getElementById("collateral").value) || 0;

  const ratio = income === 0 || tenor === 0 ? 0 : (loan / tenor / income) * 100;
  const coverage = loan === 0 ? 0 : (collateral / loan) * 100;

  const { score, decision } = tsukamoto(
    {
      income,
      ratio,
      coverage,
    },
    state.rules
  );

  updateResultUI(ratio, coverage, score, decision);
});

setMode("basic");
renderRules();
