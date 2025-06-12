const CLIENT_ID = "Ov23li5yyflTNfRcNjhc";
const REDIRECT_URI = "https://tssubhash03.github.io/index.html"; // Use GitHub Pages for this file

document.getElementById("github-login-btn").addEventListener("click", () => {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&scope=repo&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  window.open(authUrl, "_blank");
});

document.getElementById("gotoPage2").onclick = () => {
  document.getElementById("page1").style.display = "none";
  document.getElementById("page2").style.display = "block";
};

document.getElementById("backToPage1").onclick = () => {
  document.getElementById("page1").style.display = "block";
  document.getElementById("page2").style.display = "none";
};

// Edit/save/cancel for AI Key
document.getElementById("editAI").onclick = () => {
  toggleEdit("aiKey", true);
};
document.getElementById("cancelAI").onclick = () => {
  toggleEdit("aiKey", false);
};
document.getElementById("saveAI").onclick = () => {
  const key = document.getElementById("aiKey").value;
  localStorage.setItem("aiKey", key);
  toggleEdit("aiKey", false);
};

// Same for Excel Key
document.getElementById("editExcel").onclick = () => {
  toggleEdit("excelKey", true);
};
document.getElementById("cancelExcel").onclick = () => {
  toggleEdit("excelKey", false);
};
document.getElementById("saveExcel").onclick = () => {
  const key = document.getElementById("excelKey").value;
  localStorage.setItem("excelKey", key);
  toggleEdit("excelKey", false);
};

function toggleEdit(id, edit) {
  document.getElementById(id).disabled = !edit;
  document.getElementById("edit" + capitalize(id)).style.display = edit ? "none" : "inline";
  document.getElementById("save" + capitalize(id)).style.display = edit ? "inline" : "none";
  document.getElementById("cancel" + capitalize(id)).style.display = edit ? "inline" : "none";
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
