"use strict";

//settings
let settingsDisplayed = false;
let dasSlider = document.getElementById("dasSlider");
let softDropSlider = document.getElementById("softDropSlider");

//das och softDropFactor

//returnar en funktion för ett inputelement
//om man skriver in ett för högt värde i rutan blir det max
// om man skriver in ett för litet värde blir det min
//0<=value<=200
function limitFunction(min, max) {
  return function () {
    let value = parseInt(this.value);
    if (value <= max && value >= min) {
      dasSlider.value = value;
    } else if (value > max) {
      dasSlider.value = max;
      this.value = max;
    } else if (value < min) {
      dasSlider.value = min;
      this.value = min;
    }
  };
}

document.getElementById("dasAfter").oninput = limitFunction(0, 200);
document.getElementById("softDropAfter").oninput = limitFunction(0, 200);

// dasslidern ändras ändras också das
// det nya värdet sparas i localstorage
// ändrar INTE dasTime
dasSlider.oninput = () => {
  document.getElementById("dasAfter").value = dasSlider.value;
  localStorage.setItem("dasTime", dasSlider.value);
};

// samma som ovanstående
softDropSlider.oninput = () => {
  document.getElementById("softDropAfter").value = softDropSlider.value;
  localStorage.setItem("softDropFactor", softDropSlider.value);
};

// tågglar settingsrutan och pause
function settingsButton() {
  if (settingsDisplayed) {
    document.getElementById("settings").style.display = "none";
    settingsDisplayed = false;
    unpause();
  } else {
    document.getElementById("settings").style.display = "block";
    settingsDisplayed = true;
    pause();
  }
}

//skapar table för att ändra controls
for (let control in controls) {
  //definierar platsen för controlcontainer
  let controlContainer = document.getElementById("controlsinputs");

  //skapar en row i controlContainer
  let tableRow = appendElement(controlContainer, "tr");

  //skapar två tds för label och input
  let tableLabel = appendElement(tableRow, "td");
  let tableInput = appendElement(tableRow, "td");

  //skapar label och input i tds som skapades
  let input = appendElement(tableInput, "input");
  let label = appendElement(tableLabel, "label");

  //döper varje rad till kontrollen
  tableRow.id = control;

  //visar kontrollen i rutan
  label.innerHTML = control;
  input.value = controls[control].key;
  //funktionen som ändrar kontrollerna
  input.readOnly = true;
  input.class = "control";

  //callback: körs när man trycker på inputrutan
  //ändrar och sparar i game och localstorage knappen som man trycker på
  //visar rätt kontroll i inputen
  input.onclick = function () {
    //skapar en temporär eventListener som lyssnar efter den nya kontrollen
    this.addEventListener(
      "keydown",
      (event) => {
        //så att färgen ändras tillbaka
        this.blur();
        // hindrar bubbling så settings inte stängs och så att spelet inte startas om
        event.stopPropagation();

        //knappen blir lowercase för vanliga bokstäver
        let key = (function () {
          if (event.key.length == 1) {
            return event.key.toLowerCase();
          } else {
            return event.key;
          }
        })();

        //uppdatera värdet i localstorage, inputfältet och controlsobjektet

        this.value = key;
        controls[control].key = key;
        //lägger in den nya knappen i localstorage
        //den måste göra om hela objektet
        localStorage.setItem(
          "controls",
          (() => {
            let out = {};
            //loopa igenom  controls för att skapa objektet
            for (let control in controls) {
              out[control] = controls[control].key;
            }
            return JSON.stringify(out);
          })()
        );
      },
      { once: true } //parameter för eventlistenern gör så att den försvinner efter ett event
    );
  };
}

//gömmer vissa kontroller i settings
document.getElementById("up").style = "display:none";
document.getElementById("CSGO").style = "display:none";

//byt skin
function skin2() {
  for (let color of ["I", "J", "L", "T", "S", "Z", "O", "G"]) {
    document.getElementById(color).src = "skin2/" + color + ".png";
  }
}
