"use strict";

//definera diverse värden
const IMAGE_SIZE = 20; // bredden av ett block
const GRID_WIDTH = 4; // en vertikal gridlinjes bredd
const BOARD_HEIGHT = IMAGE_SIZE * 20 + GRID_WIDTH;
const BOARD_WIDTH = IMAGE_SIZE * 10 + GRID_WIDTH;
const PREVIEW_WIDTH = 100;
const HOLD_WIDTH = 100; //den vänstra sidan av boarden där hold visas
const CANVAS_WIDTH = HOLD_WIDTH + BOARD_WIDTH + PREVIEW_WIDTH;
const CANVAS_HEIGHT = BOARD_HEIGHT + IMAGE_SIZE;
const COLOR = {
  GRID: "#FFFFFF",
  TEXT: "#ffffff",
  CANVAS_BACKGROUND: "#686796",
};

//millisekunder
const LOCK_DELAY = 1500; //tid det tar innan den lockar automatiskt
const PLACE_COOLDOWN = 70; //cooldown för att biten ska lockas
//millisekunder
let dropTime = 500; //gravitation (tid för biten att droppas ett steg)
let dasTime, softDropFactor;

let ubiquitousControls = []; // alla Control-objekt som skapas med ubuquity==true sparas här
let dasControls = []; // alla objekt av DasControl sparas här

const SCORE_TABLE = [-1, 5, 25, 50, 100];
//alla kicks för I biten (utan 180)
const I_PIECE_KICKS = [
  [
    [-2, 0],
    [1, 0],
    [-2, -1],
    [1, 2],
  ],
  [
    [2, 0],
    [-1, 0],
    [2, 1],
    [-1, -2],
  ],
  [
    [-1, 0],
    [2, 0],
    [-1, 2],
    [2, -1],
  ],
  [
    [1, 0],
    [-2, 0],
    [1, -2],
    [-2, 1],
  ],
];

//alla kicks för alla bitar förutom I (inte 180 kicks)
const GENERAL_KICKS = [
  [
    [-1, 0],
    [-1, 1],
    [0, -2],
    [-1, -2],
  ],
  [
    [1, 0],
    [1, -1],
    [0, +2],
    [1, 2],
  ],
  [
    [1, 0],
    [1, 1],
    [0, -2],
    [1, -2],
  ],
  [
    [-1, 0],
    [-1, -1],
    [0, 2],
    [-1, 2],
  ],
];

//alla 180° kicks, även för I biten
const GENERAL_180_KICKS = [
  [
    [0, 1],
    [1, 1],
    [-1, 1],
    [1, 0],
    [-1, 0],
  ],
  [
    [0, -1],
    [-1, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
  ],
  [
    [1, 0],
    [1, 2],
    [1, 1],
    [0, 2],
    [0, 1],
  ],
  [
    [-1, 0],
    [-1, 2],
    [-1, 1],
    [0, 2],
    [0, 1],
  ],
];

//formerna för alla bitar utefter färg
//skrivet i relativa koordinater från bitens mitt
const COLOR_SHAPES = {
  J: [
    [-1, 1],
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  L: [
    [1, 1],
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  S: [
    [0, 1],
    [1, 1],
    [-1, 0],
    [0, 0],
  ],
  Z: [
    [-1, 1],
    [0, 1],
    [0, 0],
    [1, 0],
  ],
  T: [
    [0, 1],
    [-1, 0],
    [0, 0],
    [1, 0],
  ],
  O: [
    [-0.5, 0.5],
    [0.5, 0.5],
    [-0.5, -0.5],
    [0.5, -0.5],
  ],
  I: [
    [-1.5, 0.5],
    [-0.5, 0.5],
    [0.5, 0.5],
    [1.5, 0.5],
  ],
};

//skapar ett element och appendar det
function appendElement(parent, type) {
  return parent.appendChild(document.createElement(type));
}

class Control {
  //key: knapp, action: callback med time som argument, ubiquity: om den är aktiv under pause också
  constructor(key, action, ubiquity = false) {
    this.timePressed = 0;
    this.state = false;
    this.key = key;
    if (ubiquity) {
      // lägger in i listan om ubuquity==true
      ubiquitousControls.push(this);
    }

    // det den ska göra
    // callbackfunktionen körs om den inte pressades ned framen innan
    // tiden det skedde sparas i time
    // movementCompletion körs för b1
    this.action = (time) => {
      if (!this.timePressed) {
        this.timePressed = time;
        action(time);
        b1.pieces[0].movementCompletion();
      }
    };
  }
}

// controll för softdrop
class SoftDropControl extends Control {
  //se control, displacement är förflytting av biten
  constructor(key, action, displacement) {
    super(key);
    this.lastDrop; //hur många milllisekunder sedan den droppade senast

    this.action = (time) => {
      // om softDropFactor är noll sker alla förflyttningar omedelbart
      if (softDropFactor == 0) {
        //bitens nya position med displacement som upprepas
        let tempSoftDropCoords = b1.pieces[0].dasCoords("piece", displacement);

        //om biten inte redan befinner sig i dascoords flyttas den
        if (b1.pieces[0].pieceCoords[1] != tempSoftDropCoords[1]) {
          b1.pieces[0].pendingPieceCoords = tempSoftDropCoords; //uppdatera pending
          b1.pieces[0].movementCompletion(); //verkställ
        }

        // vanlig softdrop
        // om det har gått mer tid än softDropFactor sedan den flyttades senast från softdrop
        // flyttas den med en displacent och uppdaterar lastDrop
      } else if (time - this.lastDrop >= softDropFactor || !this.timePressed) {
        action();
        b1.pieces[0].movementCompletion();
        this.lastDrop = time; //uppdaterar delay till nästa drop
      }

      //uppdaterar när knappen trycktes ned.
      //till skillnad från vanliga kontroller har den turbo inputs(upprepas snabbare) varje intervall(definerat i inställningarna)
      this.timePressed = time;
    };
  }
}

// kontroll för upprepade förflyttningar
class DasControl extends Control {
  //se control, displacement är förflytting av biten
  constructor(key, action, displacement) {
    super(key);
    this.displacement = displacement;
    dasControls.push(this); //lägger in kontrollen i dasControls

    //körs om igen när knappen är nedtryckt (turbo)
    this.action = (time) => {
      //vanlig action (om inte nedtryckt förra intervallen)
      if (!this.timePressed) {
        //uppdaterar tiden
        this.timePressed = time;
        //kör action som var parameter för klassen
        action();
        //uppdatera biten
        b1.pieces[0].movementCompletion();
        //kolla inte das action
        return;
      }

      //das action
      //kollar om dasförflyttning ska ske och isåfall ger då nya koordinater
      let tempDasCoords = this.dasState(time);
      //flytta biten om den ska flyttas
      if (tempDasCoords) {
        b1.pieces[0].pendingPieceCoords = tempDasCoords;
        b1.pieces[0].movementCompletion();
      }
    };
  }

  //ger daskoordinater
  dasState(time) {
    //kolla om knappen har varit nedtryckt längre än dasTime
    if (time - this.timePressed >= dasTime) {
      //loopa igenom alla daskontroller
      for (let control of dasControls) {
        //om den trycktes ned innan en annan knapp så ger den inga koordinater
        //om en annan knapp har tryckts ned efter har den senare prioritet
        if (this.timePressed > control.timePressed) {
          //skaparm koordinater
          let outDasCoords = b1.pieces[0].dasCoords("piece", this.displacement);
          //om biten redan befinner sig i rätt position returnar den inte
          if (b1.pieces[0].pieceCoords[0] != outDasCoords[0]) {
            return outDasCoords;
          }
        }
      }
    }
    //returnar false om biten inte ska flyttas
    return false;
  }
}

//initiera kontrollerna och värden från localStorage om det finns sparat, skapar annars nya
//om Control(..., ..., true) så är kontrollen ubiquitous, den fungerar även när spelet är pausat
let controls = {
  left: new DasControl("ArrowLeft", () => b1.pieces[0].move([-1, 0]), [-1, 0]),
  right: new DasControl("ArrowRight", () => b1.pieces[0].move([1, 0]), [1, 0]),
  rotateCW: new Control("ArrowUp", () => b1.pieces[0].rotate(1)),
  softDrop: new SoftDropControl(
    "ArrowDown",
    () => b1.pieces[0].move([0, -1]),
    [0, -1]
  ),
  rotateCCW: new Control("z", () => b1.pieces[0].rotate(3)),
  rotate180: new Control("x", () => b1.pieces[0].rotate(2)),
  restart: new Control("q", () => resetGame(), true),
  hardDrop: new Control(" ", (time) => b1.placePiece(time)),
  up: new Control("v", () => b1.pieces[0].move([0, 1])),
  hold: new Control("c", () => b1.hold()),
  CSGO: new Control(
    "5",
    () => {
      alert("lol du suger");
      b1.score -= 100;
    },
    true
  ),
  settings: new Control("e", () => settingsButton(), true),
};

//ladda in dasTime från localstorage om det finns, annars från slidern (som har ett default värde)
//uppdaterar slidern och sliderAfter till rätt värde
dasTime =
  localStorage.getItem("dasTime") || document.getElementById("dasSlider").value;

dasSlider.value = dasTime;
document.getElementById("dasAfter").value = dasTime;

//samma för softDropFactor
softDropFactor =
  localStorage.getItem("softDropFactor") ||
  document.getElementById("softDropSlider").value;

softDropSlider.value = softDropFactor;
document.getElementById("softDropAfter").value = softDropFactor;

//kombinerar softdrop med gravity (som parallelkopplade resistorer)
softDropFactor =
  (softDropFactor * dropTime) / (parseInt(softDropFactor) + dropTime);

//laddar in kontroller från localStorage om de finns där
//kontrollerna sparas som ett json objekt
if (localStorage.getItem("controls")) {
  let x = JSON.parse(localStorage.getItem("controls"));
  for (let control in x) {
    controls[control].key = x[control];
  }
} else {
  //sätter annars in kontrollerna i localStorage
  localStorage.setItem(
    "controls",
    (() => {
      let out = {};
      for (let control in controls) {
        out[control] = controls[control].key;
      }
      return JSON.stringify(out);
    })()
  );
}

class Board {
  //parametrarna är canvasBackground: id:t för HTML-canvasen som används för griden o.d.
  //canvasForeground: id:t för en canvas som är ovanpå där bitarna ska renderas (z-index måste vara definerat rätt)
  constructor() {
    this.totalLineClears = 0;
    this.boardArray = [];
    this.isPaused = true; //ifall true, ska stoppa koden från att köras
    this.score = 0;
    this.colors = []; //kön för nästkommande bitar, alltid mellan 7-14 bitar sparade. Endast färgerna sparas. Ex: "T"
    this.piecesPlaced = 0; //bitar som satts ut (plus 1 om hold har använts)
    this.renderArray = []; //innehåller en tom board som uppdateras med de bitar som ska renderas/tas bort på boarden, renderas och clearas varje frame
    this.pieces = []; //innehåller alla piece objekt som är bitar på boarden (active piece och alla previews), hold sparas i heldPiece
    this.resetLockDelay = true; //om true, börjar om nedräkningen från LOCK_DELAY tills biten ska locka
    this.heldPiece = new Piece("G", this); //skapar temporär hold Piece
    this.pieces[0] = new ActivePiece("G", this); //temporär första bit
    this.stats = {}; //dåldål
    //skapar temporära preview bitar
    for (let x = 1; x <= 5; x++) {
      this.pieces[x] = new Piece("G", this);
    }

    this.holdState; //bool för om man inte får holda (om man redan har holdat)
    this.lastLockedTime = 0; //ändras till tiden då man sätter ut en bit. Jämförs med så man inte kan sätta ut en bit igen inom en viss tid
    this.droppedTime = 0; //senaste gången den droppade automatiskt
    this.lockDelayTime = 0; // senaste gången den lockade automatiskt

    //canvas saker

    //initiera canvasForeground - c och ctx
    //skapa element och lägg in det i body
    this.c = appendElement(document.body, "canvas");
    //sätt den framför bakgrunden
    this.c.style = "z-index: 2;";
    this.ctx = this.c.getContext("2d");
    this.c.width = CANVAS_WIDTH;
    this.c.height = CANVAS_HEIGHT;

    //initiera canvasBackground  - heter cB och ctxB
    //skapa element och lägg in det i body
    this.cB = appendElement(document.body, "canvas");
    //sätt den bakom förgrunden och sätt färgen
    this.cB.style = `z-index: 1; background-color:${COLOR.CANVAS_BACKGROUND}`;
    this.ctxB = this.cB.getContext("2d");
    this.cB.width = CANVAS_WIDTH; //canvasens width
    this.cB.height = CANVAS_HEIGHT; //canvasens height

    //rita rutnät i canvasBacground - ctxB
    this.ctxB.fillStyle = COLOR.GRID; //sätt färg
    //vertikala linjer
    for (
      let column = HOLD_WIDTH;
      column <= BOARD_WIDTH + HOLD_WIDTH;
      column = column + IMAGE_SIZE
    ) {
      this.ctxB.fillRect(column, 0, GRID_WIDTH, BOARD_HEIGHT);
    }

    //horisontella linjer
    for (let row = 0; row <= BOARD_HEIGHT; row = row + IMAGE_SIZE) {
      this.ctxB.fillRect(HOLD_WIDTH, row, BOARD_WIDTH, GRID_WIDTH);
    }

    // skriv "Score" och "Lines Cleared" för att visa text nedanför
    this.cB = appendElement(document.body, "canvas");

    /*this.statsTable = appendElement(document.body, "table");
    this.statsTable.style = "z-index: 4;";
    this.row1 = appendElement(this.statsTable, "tr");
    this.scoreThing = appendElement(this.row1, "td");
    this.stats.score = appendElement(this.scoreThing, "p");
    this.stats.score.innerText = "fasdf";*/

    this.stats.score = appendElement(document.body, "p");
    this.stats.score.innerText = "fasdf";

    //this.stats.score.style = "z-index: 1;";
    this.ctxB.fillStyle = COLOR.TEXT;
    this.ctxB.fillText(
      "Score: ",
      HOLD_WIDTH + IMAGE_SIZE * 10 + GRID_WIDTH,
      IMAGE_SIZE * 19
    );
    this.ctxB.fillText(
      "Lines Cleared: ",
      IMAGE_SIZE * 1 + GRID_WIDTH,
      IMAGE_SIZE * 10
    );
  }

  //lägger in den nuvarande boardArray i renderArray via saveBlock
  saveBoard() {
    for (let boardY = 21; boardY >= 1; boardY--) {
      for (let boardX = 1; boardX <= 10; boardX++) {
        this.saveBlock(this.boardArray[boardY][boardX], [boardX, boardY]);
      }
    }
  }

  //rendera alla block i renderArray i canvasForground
  //om rutan är X så suddas det ut istället
  render() {
    //loopa igenom alla koordinater i renderArray
    for (const y in this.renderArray) {
      for (const x in this.renderArray[y]) {
        //räkna ut blockets koordinater i canvaskoordinater
        let canvasX = HOLD_WIDTH + (x - 1) * IMAGE_SIZE + GRID_WIDTH / 2;
        let canvasY = BOARD_HEIGHT - y * IMAGE_SIZE - GRID_WIDTH / 2;
        //bestäm färgen
        let color = this.renderArray[y][x];

        //om rutan är X suddas det ut i den rutan
        if (color == "X") {
          this.ctx.clearRect(canvasX, canvasY, IMAGE_SIZE, IMAGE_SIZE);
        } else {
          //rita ut en bild
          this.ctx.drawImage(document.getElementById(color), canvasX, canvasY);
        }
      }
    }
  }

  //renderar stats i canvasForeground
  renderStats() {
    //ändra färgen och fonten
    this.ctx.fillStyle = COLOR.TEXT;
    this.ctx.font = "16px Arial";

    //ta bort rutor där score finns (hårdkodat)
    this.ctx.clearRect(
      HOLD_WIDTH + IMAGE_SIZE * 10 + GRID_WIDTH,
      IMAGE_SIZE * 18,
      PREVIEW_WIDTH,
      PREVIEW_WIDTH
    );

    //skriv ut score
    this.ctx.fillText(
      this.score,
      HOLD_WIDTH + IMAGE_SIZE * 10 + GRID_WIDTH,
      IMAGE_SIZE * 20
    );

    //-"-
    this.ctx.clearRect(0, IMAGE_SIZE * 10, HOLD_WIDTH, BOARD_HEIGHT);
    this.ctx.fillText(
      this.totalLineClears,
      IMAGE_SIZE * 1 + GRID_WIDTH,
      IMAGE_SIZE * 11
    );
  }

  //återställ boarden och starta spelet
  resetBoard() {
    //ändrar "Start" till "Restart"
    document.getElementById("startButton").innerText = "Restart";

    //återställ stats och states
    this.totalLineClears = 0;
    this.score = 0;
    this.piecesPlaced = 0;
    this.heldPiece = false;
    this.holdState = false; //gör så att man kan holda igen

    this.resetRenderArray(); //återställ renderarray så att bitar inte renderas (om något skulle renderas nästa frame)
    this.resetBoardArray(); //cleara boarden

    //töm hela canvasForeground så att allt blir tomt (behövs för gameover)
    this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    this.resetBags(); //skapar nya bags med nya bitar
    this.newPieces(); //skapar bitar och renderar previews med renderArray
    this.pieces[0].movementCompletion(); //rendera första biten och ghost och stats
    this.isPaused = false;
  }

  //skapa/återställ boarden boardArray[y][x] 1 t.o.m. 30, 1 t.o.m. 10
  //rad 24 och över ska aldrig kunna ha något i sig, men om rad 23 har något i sig så behövs rad 24 för att kunna cleara rader
  // rad 0 & kolumn 0 är inte definierade
  resetBoardArray() {
    for (let boardY = 30; boardY >= 1; boardY--) {
      this.boardArray[boardY] = [];

      for (let boardX = 1; boardX <= 10; boardX++) {
        this.boardArray[boardY][boardX] = "X";
      }
    }
  }

  //gör renderArray till en tom array (inte "X")
  resetRenderArray() {
    for (let boardY = 30; boardY >= 1; boardY--) {
      this.renderArray[boardY] = [];
    }
  }

  //lägger in två bags i arrayen this.colors som innehåller kön av bitar
  resetBags() {
    this.colors = genBag(); //lägger in bag 1
    let bag2 = genBag(); //skapar bag 2

    for (let color of bag2) {
      //lägger in bag 2 en bit i taget
      this.colors.push(color);
    }
  }

  //körs när en bit sätts ut för att flytta upp bitarna ett steg i kön och utöka kön när det behövs
  updateBags() {
    //flytta ned alla bitar
    for (let x = 0; x <= 12; x++) {
      this.colors[x] = this.colors[x + 1];
    }

    //om det finns 7 bitar kvar skapar den en ny bag
    if (this.piecesPlaced % 7 == 0) {
      let newBag = genBag(); //ny bag
      //lägg in bagen
      for (let x = 0; x < 7; x++) {
        this.colors[x + 7] = newBag[x];
      }
    }
  }

  //skapar en ny bit och kollar sedan om den kolliderar med boarden, dödar isåfall spelaren, skapar sedan previews
  newPieces() {
    //colors[0] är den nya biten som ska skapas
    this.pieces[0] = new ActivePiece(this.colors[0], this);

    //om den är i ett annat block så dör man
    if (this.pieces[0].collide(this.pieces[0].blockCoords())) {
      this.die();
    }

    for (let x = 1; x <= 5; x++) {
      this.pieces[x].savePiece(undefined, "X"); //clearar den gamla previewn
      this.pieces[x] = new Piece(this.colors[x], this, [13, 20 - x * 3]); //skapar preview
      this.pieces[x].savePiece(); //lägger in den i renderArray
    }
  }

  //kolla om activepiece kan sättas ut och gör det om det går
  placePiece(time) {
    //sätter inte ut biten om det har gått mindre än PLACE_DELAY sedan biten sattes ut förra gången
    if (time - PLACE_COOLDOWN > this.lastLockedTime) {
      this.piecesPlaced++;
      this.updateBags(); //ta nästa bit i bagen
      this.pieces[0].dieCheck(); //kolla om man försöker sätta ut biten för högt uppe
      let placedCoords = this.pieces[0].pieceInBoard(); //spara biten i boarden där den ska hamna
      this.clearLines(placedCoords); //cleara lines + öka score
      this.newPieces(); //skapa ny bit + kolla om den kan spawna + previews
      this.holdState = false; //gör så att man kan holda igen
      this.saveBoard(); //rendera boarden (tar bort biten från fel ställe och lägger dit den på rätt ställe) + renderar score
      this.lastLockedTime = time; //spara när du satte ut biten
    }
  }

  //lägger in den nuvarande biten (b1.piece[0]) i hold
  hold() {
    let tempColor; //sparar som var i hold som ska bli activepiece
    //kollar om en bit har holdats sedan en bit senast satts ut
    if (!this.holdState) {
      //kollar om det finns en bit i hold redan
      if (this.heldPiece) {
        this.heldPiece.savePiece(undefined, "X"); //cleara holdbiten ur holdplatsen
        tempColor = this.heldPiece.color; //spara vilken bit som är i hold
      }

      //rensa blivande förra active piece
      this.pieces[0].savePiece(undefined, "X");
      this.pieces[0].savePiece(this.pieces[0].dasCoords("blocks"), "X");

      //skapar en ny bit i holdbitens plats
      if (this.pieces[0].color == "I") {
        //I-biten ett steg till vänster för att den inte ska ligga direkt intill boarden
        this.heldPiece = new Piece(this.pieces[0].color, this, [-3, 15]);
      } else {
        this.heldPiece = new Piece(this.pieces[0].color, this, [-2, 15]);
      }

      //om det inte redan fanns en bit i hold
      if (!tempColor) {
        //som att sätta ut en bit (biten sätts i hold istället bara)
        this.piecesPlaced++; //ökar hur många bitar som satts ut för att bag-systemet ska funka
        this.updateBags();
        this.newPieces();
      } else {
        //normalt tillstånd
        this.pieces[0] = new ActivePiece(tempColor, this);
      }

      this.heldPiece.savePiece(); //lägger in den nya holdbiten i renderarray
      this.pieces[0].movementCompletion();
      this.holdState = true; //gör så att man inte kan holda flera gånger
    }
  }

  //lägger in ett block i renderArray
  saveBlock(color, coords) {
    this.renderArray[coords[1]][coords[0]] = color;
  }

  //ta bort en line i boardarray
  clearLine(row) {
    //loopa igenom alla rows över row inklusive row
    for (; row <= 23; row++) {
      //deep copy raden över och sätter sätter in den i raden under
      this.boardArray[row] = JSON.parse(
        JSON.stringify(this.boardArray[row + 1])
      );
    }
  }

  //kollar om det finns fulla lines på boarden och clearar dem
  //returnar hur många lines som har clearats
  clearLines(coords) {
    let lineClears = 0; //antal clearde lines
    let YArray = []; //alla y-värden som biten befinner sig i

    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      YArray[blockNumber] = coords[blockNumber][1]; //lägger in Y från activvärden i en array
    }

    //funktionen tagen från internet för att ta bort duplikat https://stackoverflow.com/questions/9229645/remove-duplicate-values-from-js-array
    //filter funktioner kollar igenom alla värden i arrayen
    //om YArray.indexOf(item) == pos tas värdet inte bort
    //YArray.indexOf(item) ger det första indexet med item
    //därför tas den andra item bort om item förekommer två gånger
    YArray = YArray.filter(function (item, pos) {
      return YArray.indexOf(item) == pos;
    });

    //sort loopar
    //byter plats på b och a om b är större än a
    YArray.sort(function (a, b) {
      return b - a;
    }); //sorterar arrayen från högst till lägst

    for (let x of YArray) {
      //kör en gång för varje Y värde i arrayen
      if (!this.boardArray[x].includes("X")) {
        //kollar om någon av koordinaterna på raden har "X"
        this.clearLine(x); //cleara raden
        lineClears++; //öka clearade rader
      }
    }

    this.score += SCORE_TABLE[lineClears]; //öka score utifrån hur många lines man clearat enligt scoretable
    this.totalLineClears += lineClears; //öka line clear count
  }

  //WIP dåldål
  loseScreen() {
    let highScore = localStorage.getItem("highScore") || 0; //updatera highscore
    let newHighScore = false;
    if (this.score > highScore) {
      newHighScore = true;

      localStorage.setItem("highScore", this.score);
    }

    //rendera död-skärm och score
    this.ctx.fillStyle = "#ff0000";
    this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    this.ctx.fillStyle = "#ffffff";
    this.ctx.font = "30px Arial";
    this.ctx.fillText("You Lose!!!", 50, 100);
    this.ctx.fillText("too bad, time to reload", 10, 400);
    this.ctx.fillText("Score: " + this.score, 30, 250);
    //rendera highscore eller "New High Score!"
    if (newHighScore) {
      this.ctx.fillText("New High Score!", 30, 300);
    } else {
      this.ctx.fillText("High Score: " + highScore, 30, 300);
    }
    this.ctx.font = "45px 'Comic Sans MS'";
    this.ctx.fillText("damn you suck", -15, 200);
  }

  //pausar spelet och displayar lose screen
  //dåldål man kan köra vidare om man pausar och unpausar
  die() {
    this.isPaused = true;
    this.loseScreen();
  }

  checkLockAndAutoDrop(time) {
    //auto drop om det har gått mer än droptime sedan senaste autodrop
    // om softdrop hålls in inkluderas gravitationen i softdrop istället
    if (time - this.droppedTime > dropTime && !controls.softDrop.state) {
      this.pieces[0].move([0, -1]);
      this.pieces[0].movementCompletion();
      this.droppedTime = time; //uppdatera när den droppades senast
    }
    if (this.resetLockDelay) {
      //resettar lockdelay om den ska resettas
      this.lockDelayTime = time; //uppdatera referensen till lockdelay
      this.resetLockDelay = false; //återställ resetlockdelay
    }
    //autolocka biten om det har gått mer än lockdelay och om biten befinner sig i shadowbiten
    else if (
      time - this.lockDelayTime > LOCK_DELAY &&
      this.pieces[0].blockCoords()[0][1] ==
        this.pieces[0].dasCoords("blocks")[0][1]
    ) {
      //auto lock piece
      this.resetLockDelay = true; // återställ resetlockdelay
      this.placePiece(time); //försök att sätta ut biten
      //this.pieces[0].saveGhost(); //
      //this.pieces[0].savePiece();
    }
  }
}

//definiera klassen piece (previews)
//inkluderar information om bitens färg(form), rotationsstatus(orientation), koordinater och vilken board biten finns på
//koordinater för varje block i biten utifrån bitens mittkoordinater
//I-bitar och O-bitars mittkoordinat måste vara mitt emellan två rutor (x och y koordinaterna inehåller .5)
class Piece {
  constructor(color, board, pieceCoords = [5, 21]) {
    this.pieceCoords = pieceCoords; //koordinater för mitten av biten
    this.color = color; //färg av biten (definierar colorshape)
    this.board = board; //vilken board den tillhör
    this.orientation = 0; //rotationstillstånd
    this.colorShape = []; //relativa koordinater för varje block jämfört med mitten (i basorientation)

    //[blockNumber][0] -> x-värde
    //[blockNumber][1] -> y-värde
    //blockens relativa startkoordinater
    //gör koordinaterna till 0 om färgen inte hittas i COLOR_SHAPES. Det händer i början av spelet, när startbitarna inte är skapade än så är color="G" som en temporär färg.
    this.colorShape = COLOR_SHAPES[color] || [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];

    //ger halva koordinater för i och o
    if (color == "O") {
      this.pieceCoords = [this.pieceCoords[0] + 0.5, this.pieceCoords[1] + 0.5]; //O piece exception
    } else if (color == "I") {
      this.pieceCoords = [this.pieceCoords[0] + 0.5, this.pieceCoords[1] - 0.5]; //I piece exception
    }
  }

  //returnar en array av block utifrån bitkoordinater och orientation
  //default är nuvarande koordinater
  blockCoords(
    pieceCoords = [this.pieceCoords[0], this.pieceCoords[1]],
    orientation = this.orientation
  ) {
    let output = [[], [], [], []];

    //loopa igenom alla block
    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      //skapa relativa koordinater för blocket utifrån colorshape (kopierar colorshape)
      output[blockNumber][0] = this.colorShape[blockNumber][0];
      output[blockNumber][1] = this.colorShape[blockNumber][1];

      //rotera runt bitens relativa mittpunkt medurs
      for (let rotations = 0; rotations < orientation; rotations++) {
        output[blockNumber] = [output[blockNumber][1], -output[blockNumber][0]];
      }
      //flytta blocket från relativ plats till bitens plats
      output[blockNumber] = [
        output[blockNumber][0] + pieceCoords[0],
        output[blockNumber][1] + pieceCoords[1],
      ];
    }
    return output;
  }

  //sätter in blockkoordinater i renderArray
  // default är nuvarande blockkoordinater
  savePiece(coords = this.blockCoords(), color = this.color) {
    //loopa igenom blocken för att sätta in blocken i renderArray
    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      this.board.saveBlock(color, [
        coords[blockNumber][0],
        coords[blockNumber][1],
      ]);
    }
  }
}

//skapar klassen för aktiv bit
//extendar Piece
//innehåller funktioner för att modifiera bitarna, som behövs för den aktiva biten.
//har pendingOrientation och pendingPieceCoords till skillnad från Piece
class ActivePiece extends Piece {
  constructor(color, board, pieceCoords) {
    super(color, board, pieceCoords);
    this.pendingOrientation = this.orientation;
    this.pendingPieceCoords = [this.pieceCoords[0], this.pieceCoords[1]];
  }

  //räknar ut koordinater för antingen block eller bit d.v.s enskilda blockkoordinater eller mittkordinater
  //"blocks" eller "piece"
  //det som returnas är koordinaterna som biten skulle ha om den flyttades med displacement tills den inte kan flyttas  längre
  //default är längst ned
  //obs skapar alltid både "piece" och "blocks"
  dasCoords(type, displacement = [0, -1]) {
    //använder nuvarande postiton
    let outputBlocks = this.blockCoords();
    let outputPieceCoords = [this.pieceCoords[0], this.pieceCoords[1]];

    //flyttar piece och blocks
    while (!this.collide(outputBlocks)) {
      // kollar om biten kolliderar eller kan flyttas längre (flyttar alltid ett steg för långt)
      for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
        //applicerar displacement
        outputBlocks[blockNumber] = [
          outputBlocks[blockNumber][0] + displacement[0],
          outputBlocks[blockNumber][1] + displacement[1],
        ];
      }

      //applicerar displacement
      outputPieceCoords = [
        outputPieceCoords[0] + displacement[0],
        outputPieceCoords[1] + displacement[1],
      ];
    }
    //blocks ska returnas
    if (type == "blocks") {
      //flytta tillbaka dem ett steg
      for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
        outputBlocks[blockNumber] = [
          outputBlocks[blockNumber][0] - displacement[0],
          outputBlocks[blockNumber][1] - displacement[1],
        ];
      }
      return outputBlocks;

      //om piecekoordinater ska returnas
    } else if (type == "piece") {
      //flytta tillbaka ett steg
      outputPieceCoords = [
        outputPieceCoords[0] - displacement[0],
        outputPieceCoords[1] - displacement[1],
      ];
      return outputPieceCoords;
    }
  }

  //roterar medsols
  //ändrar this.pendingOrientation
  //om den överstiger 3 går den tillbaka till 0
  rotate(times) {
    this.pendingOrientation = (this.orientation + times) % 4;
  }

  //flytta biten [x,y] steg
  move(displacement) {
    this.pendingPieceCoords = [
      this.pieceCoords[0] + displacement[0],
      this.pieceCoords[1] + displacement[1],
    ];
  }

  //returnar false om coords (block) inte befinner sig i något som väggen eller block på boarden
  collide(coords = this.blockCoords()) {
    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      //return true om y-värdet är under boarden
      if (coords[blockNumber][1] < 1) {
        return true;
      }
      //om de koordinaterna i boarden inte är x returnar den true
      //d.v.s. om det finns något i samma koordinat som blocket
      //obs. eftersom y-värdet är det första indexet i boardarray kan man inte sätta in ett y värde som inte finns i boarden.
      //däremot ger x-värden som inte är med i boardarray undefined d.v.s väggen som alltså räknas som något
      else if (
        this.board.boardArray[coords[blockNumber][1]][coords[blockNumber][0]] !=
        "X"
      ) {
        return true;
      }
    }
    //om den passerar alla krav collidar den inte
    return false;
  }

  //kolla om man kan sätta ut biten och om det inte går kolla om det finns möjliga kicks
  //returnar true om det går att rotera annars false
  srsCheck() {
    //kollar om pendingbiten kolliderar
    if (
      !this.collide(
        this.blockCoords(this.pendingPieceCoords, this.pendingOrientation)
      )
    ) {
      return true; //inga kicks
    }
    let priorityList = []; //displacement för kicksen i avtagande prioritet
    let o = this.orientation;
    let pO = this.pendingOrientation;

    //sätt in kicksen från kicktablen i prioritylist

    //normal kicks för i biten
    if (this.color == "I") {
      if ((o == 0 && pO == 1) || (o == 3 && pO == 2)) {
        priorityList = I_PIECE_KICKS[0];
      } else if ((o == 1 && pO == 0) || (o == 2 && pO == 3)) {
        priorityList = I_PIECE_KICKS[1];
      } else if ((o == 1 && pO == 2) || (o == 0 && pO == 3)) {
        priorityList = I_PIECE_KICKS[2];
      } else if ((o == 2 && pO == 1) || (o == 3 && pO == 0)) {
        priorityList = I_PIECE_KICKS[3];
      }
    }
    //normala kicks för de andra bitarna
    else {
      if ((o == 0 && pO == 1) || (o == 2 && pO == 1)) {
        priorityList = GENERAL_KICKS[0];
      } else if ((o == 1 && pO == 0) || (o == 1 && pO == 2)) {
        priorityList = GENERAL_KICKS[1];
      } else if ((o == 2 && pO == 3) || (o == 0 && pO == 3)) {
        priorityList = GENERAL_KICKS[2];
      } else if ((o == 3 && pO == 2) || (o == 3 && pO == 0)) {
        priorityList = GENERAL_KICKS[3];
      }
    }
    //180 kicks (samma för alla bitar)
    if (o == 0 && pO == 2) {
      priorityList = GENERAL_180_KICKS[0];
    } else if (o == 2 && pO == 0) {
      priorityList = GENERAL_180_KICKS[1];
    } else if (o == 1 && pO == 3) {
      priorityList = GENERAL_180_KICKS[2];
    } else if (o == 3 && pO == 1) {
      priorityList = GENERAL_180_KICKS[3];
    }

    //loopa igenom prioritylist och applicerar den första kicken som funkar
    for (const kick of priorityList) {
      //flytta med kick
      this.move(kick);
      //kolla om den collidar
      if (
        !this.collide(
          this.blockCoords(this.pendingPieceCoords, this.pendingOrientation)
        )
      ) {
        //om den inte collidar
        return true;
      }
    }
    //ingen kick funkar
    return false;
  }

  //lägger in pending variablerna i de officiella variablerna efter de har kontrollerats eller ändrats av collision detection och SRS
  //verkställ förflyttningen
  unpend() {
    this.orientation = this.pendingOrientation;
    this.pieceCoords = [this.pendingPieceCoords[0], this.pendingPieceCoords[1]];
  }

  //återställ pendingvärdena
  //dåldål, sämst namn, behövs det ens?
  inpend() {
    this.pendingOrientation = this.orientation;
    this.pendingPieceCoords = [this.pieceCoords[0], this.pieceCoords[1]];
  }

  //lägg in ghostbiten i renderarray så att den renderas
  saveGhost() {
    let ghostCoords = this.dasCoords("blocks");
    //loopa igenom blocken och spara dem med färgen g i renderarray
    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      this.board.saveBlock("G", [
        ghostCoords[blockNumber][0],
        ghostCoords[blockNumber][1],
      ]);
    }
  }

  //lägg in biten i boarden (inte renderarray)
  //returnar vad den sattes ut
  //det är som harddrop
  pieceInBoard() {
    let ghostCoords = this.dasCoords("blocks"); //sätt den så lång ned som möjligt
    //loopa igenom blocken och spara dem i boardarray med rätt färg
    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      this.board.boardArray[ghostCoords[blockNumber][1]][
        ghostCoords[blockNumber][0]
      ] = this.color;
    }
    return ghostCoords;
  }

  //tar bort den gamla biten och ghosten och renderar det nya
  //kollar först att biten inte kolliderar och återställer annars rörelsen
  movementCompletion() {
    if (this.srsCheck()) {
      //kolla om den kolliderar och utför eventuellt kicks om det behövs
      b1.renderStats(); //rendera om stats
      this.board.resetLockDelay = true; //gör så att den inte autolockas
      this.savePiece(undefined, "X"); //clearar gamla biten
      this.savePiece(this.dasCoords("blocks"), "X"); //clearar gamla ghost piece
      this.unpend(); //flytta biten
      this.saveGhost(); //sätt in den nya ghosten i renderarray
      this.savePiece(); //sätt in den nya biten i renderarray
    } else {
      //återställ
      this.inpend();
    }
  }

  //kollar om hela biten som sätts ut är över boarden och dödar isåfall spelaren
  dieCheck() {
    let highBlockCount = 0;
    //loopar igenom alla block
    for (let blockNumber = 0; blockNumber <= 3; blockNumber++) {
      //om ett block är över 20 så ökas highblockcount
      if (this.dasCoords("blocks")[blockNumber][1] > 20) {
        highBlockCount++;
      }
    }

    //man dör om highBlockCount är 4 eftersom då är alla block över 20
    if (highBlockCount == 4) {
      b1.die();
    }
  }
}

//skapa board
let b1 = new Board();

let rendering, keyPressesInterval, pausing; //variabel för window.requestAnimationFrame & keypresses loopen

//funktion som returnar en lista med de 7 bitarna i slumpad ordning, inspiration från en funktion vi hittade på internet
function genBag() {
  let colors = ["I", "O", "L", "J", "S", "Z", "T"]; //array med bitarna
  let randomNumber, temp;
  //tar bitarna i ordning från arrayen och byter med random bit
  for (let x in colors) {
    randomNumber = Math.floor(Math.random() * 7); //random integer från 0-6
    temp = colors[x]; //sparar biten från arrayen
    colors[x] = colors[randomNumber]; //sätter biten till samma som en random annan bit
    colors[randomNumber] = temp; //sätter den andra biten till den sparade biten
  }
  return colors;
}

//pausa spelet
function pause() {
  b1.isPaused = true;
  clearInterval(keyPressesInterval);
}

//startar spelet
//dåldål, funkar inte rätt efter död
function unpause() {
  keyPressesInterval = setInterval(keyPressesCode, 1);
  if (b1.isPaused) {
    b1.isPaused = false;
    rendering = window.requestAnimationFrame(frameCode); //börja rendera
  }
  document.activeElement.blur(); //gör att knapparna inte är markerade
  //ställ in inställningarna
  dasTime = dasSlider.value;
  softDropFactor = softDropSlider.value;
  softDropFactor =
    (softDropFactor * dropTime) / (parseInt(softDropFactor) + dropTime);
}

//startar spelet och resettar boarden
function resetGame() {
  console.log("restarting");
  unpause(); //starta spelet
  b1.resetBoard(); //resetta boarden
}

//körs varje millisekund
//behövs för att ge DAS o.d. så exakt timing som möjligt
function keyPressesCode() {
  let time = performance.now();

  if (!b1.isPaused) {
    //sluta kör om spelet är pausat
    b1.checkLockAndAutoDrop(time); //autodroppar eller låser biten när det behövs
  }

  for (let actionName in controls) {
    if (controls[actionName].state) {
      controls[actionName].action(time); //kollar vilka tangenter som är nedtryckta och kör deras action
    }
  }
}

//körs varje frame
//renderar det som ska renderas
function frameCode(time) {
  if (!b1.isPaused) {
    //sluta rendera om spelet är pausat
    b1.render(); //rendera
    b1.resetRenderArray(); //återställ listan över vad som ska renderas
    rendering = requestAnimationFrame(frameCode); //kör om igen nästa frame
  }
}

//kollar när en tangent trycks ned
//kör kontrollens action
document.addEventListener("keydown", function (event) {
  let key = (function () {
    if (event.key.length == 1) {
      return event.key.toLowerCase(); //fixa caps lock
    } else {
      return event.key; //ändrar ej kontroller som "ArrowLeft"
    }
  })();
  for (let actionName in controls) {
    //kollar efter alla controls om de matchar tangenten
    if (controls[actionName].key == key) {
      controls[actionName].state = true; //aktiverar tangenten/kontrollen, så att actionen körs i keyPressesCode
    }
  }
  for (let control of ubiquitousControls) {
    //kolla om kontrollen är ubiquitous
    if (key == control.key && b1.isPaused) {
      //om spelet är pausat
      control.action(); //kör kontrollens action
      control.state = false; //inaktivera kontrollen så att den inte körs igen dåldål? spelet är pausat
    }
  }
});

//kollar när en tangent släpps upp
//stoppar kontrollens action
document.addEventListener("keyup", function (event) {
  let key = (function () {
    if (event.key.length == 1) {
      return event.key.toLowerCase(); //fixa caps lock
    } else {
      return event.key; //ändrar ej kontroller som "ArrowLeft"
    }
  })();

  for (let actionName in controls) {
    if (controls[actionName].key == key) {
      controls[actionName].state = false; //inaktivera tangenten, stoppa actionen
      controls[actionName].timePressed = 0; //återstället tiden som tangenten varit nedtryckt
    }
  }
});

//skriver ut boardArray i p1
function aaaaaa() {
  let out = "";
  for (let temp = 23; temp >= 1; temp--) {
    out = out + "\r" + b1.renderArray[temp];
  }
  document.getElementById("p1").innerText = out;
}
