// games/gems/i18n.js — die TEXTE, die „Gem Hunt" anders braucht als die
// gemeinsame Schale: eigene Schlüssel (gem.*) und abweichende Fassungen
// (Anleitung, Einladungstext, Meister-Abzeichen). Ebene ÜBER den gemeinsamen
// Texten, solange Gem Hunt aktiv ist (s. setGameMessages). Jede Sprache trägt
// dieselben Schlüssel.

export default {
  de: {
    gem: { autoCross: "Kreuze automatisch setzen", autoCrossHint: "Ein Stein kreuzt Zeile, Spalte, Käfig und Nachbarn an.", crossColors: "Farbe der Kreuze", crossOwn: "Eigene Kreuze", crossAuto: "Automatische Kreuze", crossColorsHint: "Automatisch gesetzte Kreuze (durch einen Edelstein sicher) haben eine leicht andere Farbe – so siehst du immer, woher ein Kreuz kommt.", xc: { cage: "Käfigfarbe", soft: "Blass", gold: "Gold", mint: "Mint", sky: "Himmelblau", rose: "Rosé" }, tool: { gem: "Stein", cross: "Kreuz", aria: "Werkzeug: Stein oder Kreuz setzen" }, boardLabel: "Spielfeld: Edelsteine setzen", train: { title: "Nächster Edelstein", row: "In dieser Zeile ist nur noch ein Feld frei – alle anderen sind durch Steine, Nachbarn oder eingesperrte Käfige ausgeschlossen. Hier liegt der Edelstein.", col: "In dieser Spalte ist nur noch ein Feld frei – alle anderen sind durch Steine, Nachbarn oder eingesperrte Käfige ausgeschlossen. Hier liegt der Edelstein.", reg: "In diesem Käfig ist nur noch ein Feld frei – alle anderen sind durch Steine, Nachbarn oder Zeilen und Spalten ausgeschlossen. Hier liegt der Edelstein." } },
    howto: {
      rule1: "In jedem <b>Farbkäfig</b> ist genau <b>ein Edelstein</b> versteckt.",
      rule2: "Auch jede <b>Zeile</b> und jede <b>Spalte</b> enthält genau einen Edelstein.",
      rule3: "Zwei Edelsteine <b>berühren sich nie</b> – auch nicht über Eck.",
      rule4: "Unter dem Brett wählst du das <b>Werkzeug</b>: mit <b>Stein</b> setzt (und entfernst) ein Tippen einen Edelstein, mit <b>Kreuz</b> eine Notiz „hier nicht“ – über Felder <b>wischen</b> setzt mit beiden Werkzeugen viele Kreuze auf einmal (auf einem Kreuz begonnen: wegwischen; zurückwischen nimmt sie wieder weg).",
      rule5: "Steine, die sich widersprechen, leuchten <b>rot</b>. Ein Leben kostet es erst, wenn alle Steine liegen und es nicht aufgeht.",
      rule6: "Jedes Rätsel hat genau eine Lösung und ist <b>ohne Raten</b> lösbar. Ist das Brett gezoomt, verschiebst du es mit <b>zwei Fingern</b>.",
    },
    soloInvite: { shareText: "Spiel mit mir Gem Hunt! Tritt meinem laufenden Spiel bei – Raumcode: {code}" },
    prestige: { master: { desc: "Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Gem Hunt gemeistert hast." } },
  },
  en: {
    gem: { autoCross: "Place crosses automatically", autoCrossHint: "A gem crosses out its row, column, cage and neighbours.", crossColors: "Cross colour", crossOwn: "Your crosses", crossAuto: "Automatic crosses", crossColorsHint: "Crosses placed automatically (certain because of a gem) get a slightly different colour – so you always know where a cross came from.", xc: { cage: "Cage colour", soft: "Pale", gold: "Gold", mint: "Mint", sky: "Sky blue", rose: "Rosé" }, tool: { gem: "Gem", cross: "Cross", aria: "Tool: place a gem or a cross" }, boardLabel: "Board: place the gems", train: { title: "Next gem", row: "Only one cell is still free in this row – all others are ruled out by gems, neighbours or trapped cages. The gem goes here.", col: "Only one cell is still free in this column – all others are ruled out by gems, neighbours or trapped cages. The gem goes here.", reg: "Only one cell is still free in this cage – all others are ruled out by gems, neighbours, rows or columns. The gem goes here." } },
    howto: {
      rule1: "Each <b>coloured cage</b> hides exactly <b>one gem</b>.",
      rule2: "Every <b>row</b> and every <b>column</b> also holds exactly one gem.",
      rule3: "Two gems <b>never touch</b> – not even diagonally.",
      rule4: "Pick the <b>tool</b> below the board: with <b>Gem</b> a tap places (or removes) a gem, with <b>Cross</b> a note “not here” – <b>swipe</b> across cells (with either tool) to place many crosses at once.",
      rule5: "Gems that contradict each other glow <b>red</b>. It only costs a life once all gems are placed and it doesn’t work out.",
      rule6: "Every puzzle has exactly one solution, reachable <b>without guessing</b>. When the board is zoomed, move it with <b>two fingers</b>.",
    },
    soloInvite: { shareText: "Play Gem Hunt with me! Join my running game – room code: {code}" },
    prestige: { master: { desc: "The ultimate badge — unlocked when ALL 12 badges are Legendary. Proof that you have mastered Gem Hunt." } },
  },
  es: {
    gem: { autoCross: "Poner cruces automáticamente", autoCrossHint: "Una gema marca su fila, columna, jaula y vecinas.", crossColors: "Color de las cruces", crossOwn: "Tus cruces", crossAuto: "Cruces automáticas", crossColorsHint: "Las cruces puestas automáticamente (seguras por una gema) tienen un color algo distinto: así siempre sabes de dónde viene cada cruz.", xc: { cage: "Color de la jaula", soft: "Pálido", gold: "Oro", mint: "Menta", sky: "Celeste", rose: "Rosa" }, tool: { gem: "Gema", cross: "Cruz", aria: "Herramienta: poner gema o cruz" }, boardLabel: "Tablero: coloca las gemas", train: { title: "Siguiente gema", row: "En esta fila solo queda una casilla libre: todas las demás quedan descartadas por gemas, vecinas o jaulas encerradas. Aquí va la gema.", col: "En esta columna solo queda una casilla libre: todas las demás quedan descartadas por gemas, vecinas o jaulas encerradas. Aquí va la gema.", reg: "En esta jaula solo queda una casilla libre: todas las demás quedan descartadas por gemas, vecinas, filas o columnas. Aquí va la gema." } },
    howto: {
      rule1: "Cada <b>jaula de color</b> esconde exactamente <b>una gema</b>.",
      rule2: "Cada <b>fila</b> y cada <b>columna</b> también contiene exactamente una gema.",
      rule3: "Dos gemas <b>nunca se tocan</b>, ni siquiera en diagonal.",
      rule4: "Elige la <b>herramienta</b> bajo el tablero: con <b>Gema</b> un toque pone (o quita) una gema, con <b>Cruz</b> una nota «aquí no»; <b>desliza</b> sobre las casillas (con cualquier herramienta) para poner muchas cruces a la vez.",
      rule5: "Las gemas que se contradicen brillan en <b>rojo</b>. Solo cuesta una vida cuando todas las gemas están puestas y no encaja.",
      rule6: "Cada puzle tiene una única solución <b>sin adivinar</b>. Con el tablero ampliado, muévelo con <b>dos dedos</b>.",
    },
    soloInvite: { shareText: "¡Juega Gem Hunt conmigo! Únete a mi partida – código de sala: {code}" },
    prestige: { master: { desc: "La insignia definitiva: se desbloquea cuando TODAS las 12 insignias son legendarias. La prueba de que dominas Gem Hunt." } },
  },
  fr: {
    gem: { autoCross: "Placer les croix automatiquement", autoCrossHint: "Une gemme coche sa ligne, sa colonne, sa cage et ses voisines.", crossColors: "Couleur des croix", crossOwn: "Tes croix", crossAuto: "Croix automatiques", crossColorsHint: "Les croix posées automatiquement (sûres grâce à une gemme) ont une couleur légèrement différente – tu sais toujours d’où vient une croix.", xc: { cage: "Couleur de la cage", soft: "Pâle", gold: "Or", mint: "Menthe", sky: "Bleu ciel", rose: "Rosé" }, tool: { gem: "Gemme", cross: "Croix", aria: "Outil : poser une gemme ou une croix" }, boardLabel: "Grille : place les gemmes", train: { title: "Gemme suivante", row: "Il ne reste qu’une case libre dans cette ligne – toutes les autres sont exclues par des gemmes, des voisines ou des cages enfermées. La gemme va ici.", col: "Il ne reste qu’une case libre dans cette colonne – toutes les autres sont exclues par des gemmes, des voisines ou des cages enfermées. La gemme va ici.", reg: "Il ne reste qu’une case libre dans cette cage – toutes les autres sont exclues par des gemmes, des voisines, des lignes ou des colonnes. La gemme va ici." } },
    howto: {
      rule1: "Chaque <b>cage colorée</b> cache exactement <b>une gemme</b>.",
      rule2: "Chaque <b>ligne</b> et chaque <b>colonne</b> contient aussi exactement une gemme.",
      rule3: "Deux gemmes <b>ne se touchent jamais</b> – pas même en diagonale.",
      rule4: "Choisis l’<b>outil</b> sous la grille : avec <b>Gemme</b>, une touche pose (ou retire) une gemme, avec <b>Croix</b> une note « pas ici » – <b>glisse</b> sur les cases (avec les deux outils) pour poser plusieurs croix d’un coup.",
      rule5: "Les gemmes qui se contredisent brillent en <b>rouge</b>. Cela ne coûte une vie que lorsque toutes les gemmes sont posées et que ça ne colle pas.",
      rule6: "Chaque grille a une seule solution, <b>sans deviner</b>. Si la grille est zoomée, déplace-la avec <b>deux doigts</b>.",
    },
    soloInvite: { shareText: "Joue à Gem Hunt avec moi ! Rejoins ma partie – code du salon : {code}" },
    prestige: { master: { desc: "Le badge ultime — débloqué quand LES 12 badges sont Légendaires. La preuve que tu maîtrises Gem Hunt." } },
  },
  "pt-BR": {
    gem: { autoCross: "Marcar X automaticamente", autoCrossHint: "Cada gema marca X nas vizinhas, na linha, na coluna e na jaula – ao tirá-la, esses X somem. Desligado = todos os X à mão.", tool: { gem: "Gema", cross: "X", aria: "Ferramenta: colocar gema ou X" }, boardLabel: "Tabuleiro: coloque as gemas", train: { title: "Próxima gema", row: "Nesta linha só resta uma casa livre – todas as outras foram descartadas por gemas, vizinhas ou jaulas presas. A gema fica aqui.", col: "Nesta coluna só resta uma casa livre – todas as outras foram descartadas por gemas, vizinhas ou jaulas presas. A gema fica aqui.", reg: "Nesta jaula só resta uma casa livre – todas as outras foram descartadas por gemas, vizinhas, linhas ou colunas. A gema fica aqui." } },
    howto: {
      rule1: "Cada <b>jaula colorida</b> esconde exatamente <b>uma gema</b>.",
      rule2: "Cada <b>linha</b> e cada <b>coluna</b> também tem exatamente uma gema.",
      rule3: "Duas gemas <b>nunca se tocam</b> – nem na diagonal.",
      rule4: "Escolha a <b>ferramenta</b> abaixo do tabuleiro: com <b>Gema</b> um toque coloca (ou tira) uma gema, com <b>X</b> uma nota “aqui não” – <b>deslize</b> sobre as casas (com qualquer ferramenta) para marcar vários X de uma vez.",
      rule5: "Gemas que se contradizem brilham em <b>vermelho</b>. Só custa uma vida quando todas as gemas estão postas e não fecha.",
      rule6: "Cada quebra-cabeça tem uma única solução, <b>sem chutar</b>. Com o tabuleiro ampliado, mova-o com <b>dois dedos</b>.",
    },
    soloInvite: { shareText: "Jogue Gem Hunt comigo! Entre na minha partida – código da sala: {code}" },
    prestige: { master: { desc: "O emblema definitivo — desbloqueado quando TODOS os 12 emblemas são lendários. A prova de que você domina Gem Hunt." } },
  },
  it: {
    gem: { autoCross: "Metti le croci automaticamente", autoCrossHint: "Una gemma segna riga, colonna, gabbia e vicine.", crossColors: "Colore delle croci", crossOwn: "Le tue croci", crossAuto: "Croci automatiche", crossColorsHint: "Le croci messe automaticamente (sicure grazie a una gemma) hanno un colore leggermente diverso: così sai sempre da dove viene una croce.", xc: { cage: "Colore della gabbia", soft: "Pallido", gold: "Oro", mint: "Menta", sky: "Azzurro", rose: "Rosé" }, tool: { gem: "Gemma", cross: "Croce", aria: "Strumento: metti gemma o croce" }, boardLabel: "Griglia: piazza le gemme", train: { title: "Prossima gemma", row: "In questa riga resta libera una sola casella: tutte le altre sono escluse da gemme, vicine o gabbie bloccate. Qui va la gemma.", col: "In questa colonna resta libera una sola casella: tutte le altre sono escluse da gemme, vicine o gabbie bloccate. Qui va la gemma.", reg: "In questa gabbia resta libera una sola casella: tutte le altre sono escluse da gemme, vicine, righe o colonne. Qui va la gemma." } },
    howto: {
      rule1: "Ogni <b>gabbia colorata</b> nasconde esattamente <b>una gemma</b>.",
      rule2: "Anche ogni <b>riga</b> e ogni <b>colonna</b> contiene esattamente una gemma.",
      rule3: "Due gemme <b>non si toccano mai</b>, nemmeno in diagonale.",
      rule4: "Scegli lo <b>strumento</b> sotto la griglia: con <b>Gemma</b> un tocco mette (o toglie) una gemma, con <b>Croce</b> una nota «qui no» – <b>scorri</b> sulle caselle (con entrambi gli strumenti) per mettere tante croci in una volta.",
      rule5: "Le gemme in contraddizione si illuminano di <b>rosso</b>. Si perde una vita solo quando tutte le gemme sono piazzate e non torna.",
      rule6: "Ogni rompicapo ha una sola soluzione, <b>senza tirare a indovinare</b>. Con la griglia ingrandita, spostala con <b>due dita</b>.",
    },
    soloInvite: { shareText: "Gioca a Gem Hunt con me! Unisciti alla mia partita – codice stanza: {code}" },
    prestige: { master: { desc: "Il badge definitivo — si sblocca quando TUTTI i 12 badge sono leggendari. La prova che hai padroneggiato Gem Hunt." } },
  },
  ja: {
    gem: { autoCross: "×を自動で置く", autoCrossHint: "宝石が行・列・エリア・隣接マスに×を付けます。", crossColors: "×の色", crossOwn: "自分の×", crossAuto: "自動の×", crossColorsHint: "自動で置かれた×（宝石によって確定）は少し違う色になります。どの×がどこから来たか、いつでも分かります。", xc: { cage: "エリアの色", soft: "淡い", gold: "ゴールド", mint: "ミント", sky: "スカイブルー", rose: "ローズ" }, tool: { gem: "宝石", cross: "×", aria: "ツール：宝石か×を置く" }, boardLabel: "盤面：宝石を置く", train: { title: "次の宝石", row: "この行で空いているマスはあと1つだけです。他はすべて宝石・隣接・閉じ込められたエリアのために置けません。宝石はここです。", col: "この列で空いているマスはあと1つだけです。他はすべて宝石・隣接・閉じ込められたエリアのために置けません。宝石はここです。", reg: "このエリアで空いているマスはあと1つだけです。他はすべて宝石・隣接・行や列のために置けません。宝石はここです。" } },
    howto: {
      rule1: "色分けされた各<b>エリア</b>には、<b>宝石がちょうど1つ</b>隠れています。",
      rule2: "各<b>行</b>と各<b>列</b>にも、宝石はちょうど1つです。",
      rule3: "宝石同士は<b>決して接しません</b>（斜めも不可）。",
      rule4: "盤面の下で<b>ツール</b>を選びます。<b>宝石</b>ではタップで宝石を置く（外す）、<b>×</b>では「ここではない」メモを置きます。どちらのツールでも、マスの上を<b>なぞる</b>とまとめて×を置けます。",
      rule5: "矛盾する宝石は<b>赤く</b>光ります。ライフが減るのは、すべての宝石を置いても正解でないときだけです。",
      rule6: "どのパズルも答えは1つで、<b>推測なし</b>で解けます。拡大中は<b>2本指</b>で盤面を動かせます。",
    },
    soloInvite: { shareText: "一緒にGem Huntをプレイしよう！進行中のゲームに参加してね – ルームコード：{code}" },
    prestige: { master: { desc: "究極のバッジ — 12個すべてのバッジがレジェンドになると解放。Gem Huntを極めた証です。" } },
  },
  ko: {
    gem: { autoCross: "X 자동으로 놓기", autoCrossHint: "보석이 행, 열, 구역, 이웃 칸에 X를 표시합니다.", crossColors: "X 색상", crossOwn: "내가 놓은 X", crossAuto: "자동 X", crossColorsHint: "자동으로 놓인 X(보석 때문에 확실한 칸)는 색이 살짝 달라요. 어떤 X가 어디서 왔는지 항상 알 수 있어요.", xc: { cage: "구역 색", soft: "연하게", gold: "골드", mint: "민트", sky: "하늘색", rose: "로제" }, tool: { gem: "보석", cross: "X", aria: "도구: 보석 또는 X 놓기" }, boardLabel: "게임판: 보석 놓기", train: { title: "다음 보석", row: "이 행에는 빈칸이 하나만 남았어요. 나머지는 보석, 이웃 칸, 갇힌 구역 때문에 모두 제외됩니다. 보석은 여기예요.", col: "이 열에는 빈칸이 하나만 남았어요. 나머지는 보석, 이웃 칸, 갇힌 구역 때문에 모두 제외됩니다. 보석은 여기예요.", reg: "이 구역에는 빈칸이 하나만 남았어요. 나머지는 보석, 이웃 칸, 행이나 열 때문에 모두 제외됩니다. 보석은 여기예요." } },
    howto: {
      rule1: "색깔 <b>구역</b>마다 <b>보석이 정확히 하나</b> 숨어 있어요.",
      rule2: "모든 <b>행</b>과 <b>열</b>에도 보석이 정확히 하나씩 있어요.",
      rule3: "두 보석은 <b>절대 닿지 않아요</b> – 대각선으로도요.",
      rule4: "게임판 아래에서 <b>도구</b>를 고르세요. <b>보석</b>은 탭으로 보석을 놓거나 치우고, <b>X</b>는 “여기 아님” 메모를 놓아요. 어느 도구로든 칸 위를 <b>쓸면</b> X를 한꺼번에 놓을 수 있어요.",
      rule5: "서로 모순되는 보석은 <b>빨갛게</b> 빛나요. 모든 보석을 놓았는데 맞지 않을 때만 목숨이 줄어요.",
      rule6: "모든 퍼즐은 정답이 하나이고 <b>추측 없이</b> 풀 수 있어요. 확대했을 때는 <b>두 손가락</b>으로 판을 옮기세요.",
    },
    soloInvite: { shareText: "나랑 Gem Hunt 하자! 진행 중인 게임에 참여해 – 방 코드: {code}" },
    prestige: { master: { desc: "궁극의 배지 — 12개 배지가 모두 레전드가 되면 해제돼요. Gem Hunt를 정복했다는 증거입니다." } },
  },
  tr: {
    gem: { autoCross: "Çarpıları otomatik koy", autoCrossHint: "Bir mücevher satırını, sütununu, bölgesini ve komşularını çarpılar.", crossColors: "Çarpı rengi", crossOwn: "Senin çarpıların", crossAuto: "Otomatik çarpılar", crossColorsHint: "Otomatik konan çarpılar (bir mücevher sayesinde kesin) biraz farklı renktedir – her çarpının nereden geldiğini hep bilirsin.", xc: { cage: "Bölge rengi", soft: "Soluk", gold: "Altın", mint: "Nane", sky: "Gök mavisi", rose: "Gül" }, tool: { gem: "Mücevher", cross: "Çarpı", aria: "Araç: mücevher veya çarpı koy" }, boardLabel: "Oyun alanı: mücevherleri yerleştir", train: { title: "Sonraki mücevher", row: "Bu satırda yalnızca bir boş kare kaldı – diğerleri mücevherler, komşular veya kapana kısılmış bölgeler yüzünden elendi. Mücevher burada.", col: "Bu sütunda yalnızca bir boş kare kaldı – diğerleri mücevherler, komşular veya kapana kısılmış bölgeler yüzünden elendi. Mücevher burada.", reg: "Bu bölgede yalnızca bir boş kare kaldı – diğerleri mücevherler, komşular, satırlar veya sütunlar yüzünden elendi. Mücevher burada." } },
    howto: {
      rule1: "Her <b>renkli bölgede</b> tam olarak <b>bir mücevher</b> saklı.",
      rule2: "Her <b>satırda</b> ve her <b>sütunda</b> da tam olarak bir mücevher var.",
      rule3: "İki mücevher <b>asla birbirine değmez</b> – çaprazdan bile.",
      rule4: "Tahtanın altından <b>aracı</b> seç: <b>Mücevher</b> ile dokunmak mücevher koyar (veya kaldırır), <b>Çarpı</b> ile “burada değil” notu koyar – birçok çarpı için (iki araçla da) karelerin üzerinde <b>kaydır</b>.",
      rule5: "Birbiriyle çelişen mücevherler <b>kırmızı</b> parlar. Can, ancak tüm mücevherler yerleştirilip tutmadığında gider.",
      rule6: "Her bulmacanın tek bir çözümü var ve <b>tahmin etmeden</b> çözülür. Alan büyütülmüşse <b>iki parmakla</b> kaydır.",
    },
    soloInvite: { shareText: "Benimle Gem Hunt oyna! Devam eden oyunuma katıl – oda kodu: {code}" },
    prestige: { master: { desc: "Nihai rozet — 12 rozetin TAMAMI Efsanevi olduğunda açılır. Gem Hunt'ta ustalaştığının kanıtı." } },
  },
  ru: {
    gem: { autoCross: "Ставить крестики автоматически", autoCrossHint: "Самоцвет отмечает строку, столбец, область и соседей.", crossColors: "Цвет крестиков", crossOwn: "Свои крестики", crossAuto: "Автоматические крестики", crossColorsHint: "Автоматически поставленные крестики (точные благодаря самоцвету) немного другого цвета – так всегда видно, откуда крестик.", xc: { cage: "Цвет области", soft: "Бледный", gold: "Золото", mint: "Мята", sky: "Небесный", rose: "Розовый" }, tool: { gem: "Камень", cross: "Крестик", aria: "Инструмент: поставить камень или крестик" }, boardLabel: "Поле: расставь самоцветы", train: { title: "Следующий самоцвет", row: "В этой строке осталась только одна свободная клетка – остальные исключены самоцветами, соседями или запертыми областями. Самоцвет здесь.", col: "В этом столбце осталась только одна свободная клетка – остальные исключены самоцветами, соседями или запертыми областями. Самоцвет здесь.", reg: "В этой области осталась только одна свободная клетка – остальные исключены самоцветами, соседями, строками или столбцами. Самоцвет здесь." } },
    howto: {
      rule1: "В каждой <b>цветной области</b> спрятан ровно <b>один самоцвет</b>.",
      rule2: "В каждой <b>строке</b> и каждом <b>столбце</b> тоже ровно один самоцвет.",
      rule3: "Два самоцвета <b>никогда не касаются</b> – даже по диагонали.",
      rule4: "Под полем выбери <b>инструмент</b>: с <b>Камнем</b> нажатие ставит (или убирает) самоцвет, с <b>Крестиком</b> — заметку «не здесь». <b>Проведи</b> по клеткам (любым инструментом), чтобы поставить много крестиков сразу.",
      rule5: "Противоречащие самоцветы светятся <b>красным</b>. Жизнь теряется, только когда все самоцветы стоят, а решение не сходится.",
      rule6: "У каждой головоломки одно решение, и она решается <b>без угадывания</b>. Если поле увеличено, двигай его <b>двумя пальцами</b>.",
    },
    soloInvite: { shareText: "Сыграй со мной в Gem Hunt! Присоединяйся к моей игре – код комнаты: {code}" },
    prestige: { master: { desc: "Высший значок — открывается, когда ВСЕ 12 значков легендарные. Доказательство, что ты освоил Gem Hunt." } },
  },
};
