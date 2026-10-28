// games/gems/i18n.js — die TEXTE, die „Gem Hunt" anders braucht als die
// gemeinsame Schale: eigene Schlüssel (gem.*) und abweichende Fassungen
// (Anleitung, Einladungstext, Meister-Abzeichen). Ebene ÜBER den gemeinsamen
// Texten, solange Gem Hunt aktiv ist (s. setGameMessages). Jede Sprache trägt
// dieselben Schlüssel.

export default {
  de: {
    gem: { boardLabel: "Spielfeld: Edelsteine setzen", train: { title: "Nächster Edelstein", row: "In dieser Zeile ist nur noch ein Feld frei – alle anderen sind durch Steine, Nachbarn oder eingesperrte Käfige ausgeschlossen. Hier liegt der Edelstein.", col: "In dieser Spalte ist nur noch ein Feld frei – alle anderen sind durch Steine, Nachbarn oder eingesperrte Käfige ausgeschlossen. Hier liegt der Edelstein.", reg: "In diesem Käfig ist nur noch ein Feld frei – alle anderen sind durch Steine, Nachbarn oder Zeilen und Spalten ausgeschlossen. Hier liegt der Edelstein." } },
    howto: {
      rule1: "In jedem <b>Farbkäfig</b> ist genau <b>ein Edelstein</b> versteckt.",
      rule2: "Auch jede <b>Zeile</b> und jede <b>Spalte</b> enthält genau einen Edelstein.",
      rule3: "Zwei Edelsteine <b>berühren sich nie</b> – auch nicht über Eck.",
      rule4: "<b>Antippen</b>: leer → Kreuz (Notiz „hier nicht“) → Edelstein → leer. Über Felder <b>wischen</b> setzt viele Kreuze auf einmal.",
      rule5: "Steine, die sich widersprechen, leuchten <b>rot</b>. Ein Leben kostet es erst, wenn alle Steine liegen und es nicht aufgeht.",
      rule6: "Jedes Rätsel hat genau eine Lösung und ist <b>ohne Raten</b> lösbar. Ist das Brett gezoomt, verschiebst du es mit <b>zwei Fingern</b>.",
    },
    soloInvite: { shareText: "Spiel mit mir Gem Hunt! Tritt meinem laufenden Spiel bei – Raumcode: {code}" },
    prestige: { master: { desc: "Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Gem Hunt gemeistert hast." } },
  },
  en: {
    gem: { boardLabel: "Board: place the gems", train: { title: "Next gem", row: "Only one cell is still free in this row – all others are ruled out by gems, neighbours or trapped cages. The gem goes here.", col: "Only one cell is still free in this column – all others are ruled out by gems, neighbours or trapped cages. The gem goes here.", reg: "Only one cell is still free in this cage – all others are ruled out by gems, neighbours, rows or columns. The gem goes here." } },
    howto: {
      rule1: "Each <b>coloured cage</b> hides exactly <b>one gem</b>.",
      rule2: "Every <b>row</b> and every <b>column</b> also holds exactly one gem.",
      rule3: "Two gems <b>never touch</b> – not even diagonally.",
      rule4: "<b>Tap</b>: empty → cross (note “not here”) → gem → empty. <b>Swipe</b> across cells to place many crosses at once.",
      rule5: "Gems that contradict each other glow <b>red</b>. It only costs a life once all gems are placed and it doesn’t work out.",
      rule6: "Every puzzle has exactly one solution, reachable <b>without guessing</b>. When the board is zoomed, move it with <b>two fingers</b>.",
    },
    soloInvite: { shareText: "Play Gem Hunt with me! Join my running game – room code: {code}" },
    prestige: { master: { desc: "The ultimate badge — unlocked when ALL 12 badges are Legendary. Proof that you have mastered Gem Hunt." } },
  },
  es: {
    gem: { boardLabel: "Tablero: coloca las gemas", train: { title: "Siguiente gema", row: "En esta fila solo queda una casilla libre: todas las demás quedan descartadas por gemas, vecinas o jaulas encerradas. Aquí va la gema.", col: "En esta columna solo queda una casilla libre: todas las demás quedan descartadas por gemas, vecinas o jaulas encerradas. Aquí va la gema.", reg: "En esta jaula solo queda una casilla libre: todas las demás quedan descartadas por gemas, vecinas, filas o columnas. Aquí va la gema." } },
    howto: {
      rule1: "Cada <b>jaula de color</b> esconde exactamente <b>una gema</b>.",
      rule2: "Cada <b>fila</b> y cada <b>columna</b> también contiene exactamente una gema.",
      rule3: "Dos gemas <b>nunca se tocan</b>, ni siquiera en diagonal.",
      rule4: "<b>Toca</b>: vacía → cruz (nota «aquí no») → gema → vacía. <b>Desliza</b> sobre casillas para poner muchas cruces a la vez.",
      rule5: "Las gemas que se contradicen brillan en <b>rojo</b>. Solo cuesta una vida cuando todas las gemas están puestas y no encaja.",
      rule6: "Cada puzle tiene una única solución <b>sin adivinar</b>. Con el tablero ampliado, muévelo con <b>dos dedos</b>.",
    },
    soloInvite: { shareText: "¡Juega Gem Hunt conmigo! Únete a mi partida – código de sala: {code}" },
    prestige: { master: { desc: "La insignia definitiva: se desbloquea cuando TODAS las 12 insignias son legendarias. La prueba de que dominas Gem Hunt." } },
  },
  fr: {
    gem: { boardLabel: "Grille : place les gemmes", train: { title: "Gemme suivante", row: "Il ne reste qu’une case libre dans cette ligne – toutes les autres sont exclues par des gemmes, des voisines ou des cages enfermées. La gemme va ici.", col: "Il ne reste qu’une case libre dans cette colonne – toutes les autres sont exclues par des gemmes, des voisines ou des cages enfermées. La gemme va ici.", reg: "Il ne reste qu’une case libre dans cette cage – toutes les autres sont exclues par des gemmes, des voisines, des lignes ou des colonnes. La gemme va ici." } },
    howto: {
      rule1: "Chaque <b>cage colorée</b> cache exactement <b>une gemme</b>.",
      rule2: "Chaque <b>ligne</b> et chaque <b>colonne</b> contient aussi exactement une gemme.",
      rule3: "Deux gemmes <b>ne se touchent jamais</b> – pas même en diagonale.",
      rule4: "<b>Touche</b> : vide → croix (note « pas ici ») → gemme → vide. <b>Glisse</b> sur les cases pour poser plein de croix d’un coup.",
      rule5: "Les gemmes qui se contredisent brillent en <b>rouge</b>. Cela ne coûte une vie que lorsque toutes les gemmes sont posées et que ça ne colle pas.",
      rule6: "Chaque grille a une seule solution, <b>sans deviner</b>. Si la grille est zoomée, déplace-la avec <b>deux doigts</b>.",
    },
    soloInvite: { shareText: "Joue à Gem Hunt avec moi ! Rejoins ma partie – code du salon : {code}" },
    prestige: { master: { desc: "Le badge ultime — débloqué quand LES 12 badges sont Légendaires. La preuve que tu maîtrises Gem Hunt." } },
  },
  "pt-BR": {
    gem: { boardLabel: "Tabuleiro: coloque as gemas", train: { title: "Próxima gema", row: "Nesta linha só resta uma casa livre – todas as outras foram descartadas por gemas, vizinhas ou jaulas presas. A gema fica aqui.", col: "Nesta coluna só resta uma casa livre – todas as outras foram descartadas por gemas, vizinhas ou jaulas presas. A gema fica aqui.", reg: "Nesta jaula só resta uma casa livre – todas as outras foram descartadas por gemas, vizinhas, linhas ou colunas. A gema fica aqui." } },
    howto: {
      rule1: "Cada <b>jaula colorida</b> esconde exatamente <b>uma gema</b>.",
      rule2: "Cada <b>linha</b> e cada <b>coluna</b> também tem exatamente uma gema.",
      rule3: "Duas gemas <b>nunca se tocam</b> – nem na diagonal.",
      rule4: "<b>Toque</b>: vazia → x (nota “aqui não”) → gema → vazia. <b>Deslize</b> sobre as casas para marcar vários x de uma vez.",
      rule5: "Gemas que se contradizem brilham em <b>vermelho</b>. Só custa uma vida quando todas as gemas estão postas e não fecha.",
      rule6: "Cada quebra-cabeça tem uma única solução, <b>sem chutar</b>. Com o tabuleiro ampliado, mova-o com <b>dois dedos</b>.",
    },
    soloInvite: { shareText: "Jogue Gem Hunt comigo! Entre na minha partida – código da sala: {code}" },
    prestige: { master: { desc: "O emblema definitivo — desbloqueado quando TODOS os 12 emblemas são lendários. A prova de que você domina Gem Hunt." } },
  },
  it: {
    gem: { boardLabel: "Griglia: piazza le gemme", train: { title: "Prossima gemma", row: "In questa riga resta libera una sola casella: tutte le altre sono escluse da gemme, vicine o gabbie bloccate. Qui va la gemma.", col: "In questa colonna resta libera una sola casella: tutte le altre sono escluse da gemme, vicine o gabbie bloccate. Qui va la gemma.", reg: "In questa gabbia resta libera una sola casella: tutte le altre sono escluse da gemme, vicine, righe o colonne. Qui va la gemma." } },
    howto: {
      rule1: "Ogni <b>gabbia colorata</b> nasconde esattamente <b>una gemma</b>.",
      rule2: "Anche ogni <b>riga</b> e ogni <b>colonna</b> contiene esattamente una gemma.",
      rule3: "Due gemme <b>non si toccano mai</b>, nemmeno in diagonale.",
      rule4: "<b>Tocca</b>: vuota → croce (nota «qui no») → gemma → vuota. <b>Scorri</b> sulle caselle per mettere tante croci insieme.",
      rule5: "Le gemme in contraddizione si illuminano di <b>rosso</b>. Si perde una vita solo quando tutte le gemme sono piazzate e non torna.",
      rule6: "Ogni rompicapo ha una sola soluzione, <b>senza tirare a indovinare</b>. Con la griglia ingrandita, spostala con <b>due dita</b>.",
    },
    soloInvite: { shareText: "Gioca a Gem Hunt con me! Unisciti alla mia partita – codice stanza: {code}" },
    prestige: { master: { desc: "Il badge definitivo — si sblocca quando TUTTI i 12 badge sono leggendari. La prova che hai padroneggiato Gem Hunt." } },
  },
  ja: {
    gem: { boardLabel: "盤面：宝石を置く", train: { title: "次の宝石", row: "この行で空いているマスはあと1つだけです。他はすべて宝石・隣接・閉じ込められたエリアのために置けません。宝石はここです。", col: "この列で空いているマスはあと1つだけです。他はすべて宝石・隣接・閉じ込められたエリアのために置けません。宝石はここです。", reg: "このエリアで空いているマスはあと1つだけです。他はすべて宝石・隣接・行や列のために置けません。宝石はここです。" } },
    howto: {
      rule1: "色分けされた各<b>エリア</b>には、<b>宝石がちょうど1つ</b>隠れています。",
      rule2: "各<b>行</b>と各<b>列</b>にも、宝石はちょうど1つです。",
      rule3: "宝石同士は<b>決して接しません</b>（斜めも不可）。",
      rule4: "<b>タップ</b>：空 → ×（「ここではない」メモ）→ 宝石 → 空。マスを<b>なぞる</b>と×をまとめて置けます。",
      rule5: "矛盾する宝石は<b>赤く</b>光ります。ライフが減るのは、すべての宝石を置いても正解でないときだけです。",
      rule6: "どのパズルも答えは1つで、<b>推測なし</b>で解けます。拡大中は<b>2本指</b>で盤面を動かせます。",
    },
    soloInvite: { shareText: "一緒にGem Huntをプレイしよう！進行中のゲームに参加してね – ルームコード：{code}" },
    prestige: { master: { desc: "究極のバッジ — 12個すべてのバッジがレジェンドになると解放。Gem Huntを極めた証です。" } },
  },
  ko: {
    gem: { boardLabel: "게임판: 보석 놓기", train: { title: "다음 보석", row: "이 행에는 빈칸이 하나만 남았어요. 나머지는 보석, 이웃 칸, 갇힌 구역 때문에 모두 제외됩니다. 보석은 여기예요.", col: "이 열에는 빈칸이 하나만 남았어요. 나머지는 보석, 이웃 칸, 갇힌 구역 때문에 모두 제외됩니다. 보석은 여기예요.", reg: "이 구역에는 빈칸이 하나만 남았어요. 나머지는 보석, 이웃 칸, 행이나 열 때문에 모두 제외됩니다. 보석은 여기예요." } },
    howto: {
      rule1: "색깔 <b>구역</b>마다 <b>보석이 정확히 하나</b> 숨어 있어요.",
      rule2: "모든 <b>행</b>과 <b>열</b>에도 보석이 정확히 하나씩 있어요.",
      rule3: "두 보석은 <b>절대 닿지 않아요</b> – 대각선으로도요.",
      rule4: "<b>탭</b>: 빈칸 → X(“여기 아님” 메모) → 보석 → 빈칸. 칸 위를 <b>쓸면</b> X를 한 번에 여러 개 놓을 수 있어요.",
      rule5: "서로 모순되는 보석은 <b>빨갛게</b> 빛나요. 모든 보석을 놓았는데 맞지 않을 때만 목숨이 줄어요.",
      rule6: "모든 퍼즐은 정답이 하나이고 <b>추측 없이</b> 풀 수 있어요. 확대했을 때는 <b>두 손가락</b>으로 판을 옮기세요.",
    },
    soloInvite: { shareText: "나랑 Gem Hunt 하자! 진행 중인 게임에 참여해 – 방 코드: {code}" },
    prestige: { master: { desc: "궁극의 배지 — 12개 배지가 모두 레전드가 되면 해제돼요. Gem Hunt를 정복했다는 증거입니다." } },
  },
  tr: {
    gem: { boardLabel: "Oyun alanı: mücevherleri yerleştir", train: { title: "Sonraki mücevher", row: "Bu satırda yalnızca bir boş kare kaldı – diğerleri mücevherler, komşular veya kapana kısılmış bölgeler yüzünden elendi. Mücevher burada.", col: "Bu sütunda yalnızca bir boş kare kaldı – diğerleri mücevherler, komşular veya kapana kısılmış bölgeler yüzünden elendi. Mücevher burada.", reg: "Bu bölgede yalnızca bir boş kare kaldı – diğerleri mücevherler, komşular, satırlar veya sütunlar yüzünden elendi. Mücevher burada." } },
    howto: {
      rule1: "Her <b>renkli bölgede</b> tam olarak <b>bir mücevher</b> saklı.",
      rule2: "Her <b>satırda</b> ve her <b>sütunda</b> da tam olarak bir mücevher var.",
      rule3: "İki mücevher <b>asla birbirine değmez</b> – çaprazdan bile.",
      rule4: "<b>Dokun</b>: boş → çarpı (“burada değil” notu) → mücevher → boş. Kareler üzerinde <b>kaydırarak</b> çok sayıda çarpı koyabilirsin.",
      rule5: "Birbiriyle çelişen mücevherler <b>kırmızı</b> parlar. Can, ancak tüm mücevherler yerleştirilip tutmadığında gider.",
      rule6: "Her bulmacanın tek bir çözümü var ve <b>tahmin etmeden</b> çözülür. Alan büyütülmüşse <b>iki parmakla</b> kaydır.",
    },
    soloInvite: { shareText: "Benimle Gem Hunt oyna! Devam eden oyunuma katıl – oda kodu: {code}" },
    prestige: { master: { desc: "Nihai rozet — 12 rozetin TAMAMI Efsanevi olduğunda açılır. Gem Hunt'ta ustalaştığının kanıtı." } },
  },
  ru: {
    gem: { boardLabel: "Поле: расставь самоцветы", train: { title: "Следующий самоцвет", row: "В этой строке осталась только одна свободная клетка – остальные исключены самоцветами, соседями или запертыми областями. Самоцвет здесь.", col: "В этом столбце осталась только одна свободная клетка – остальные исключены самоцветами, соседями или запертыми областями. Самоцвет здесь.", reg: "В этой области осталась только одна свободная клетка – остальные исключены самоцветами, соседями, строками или столбцами. Самоцвет здесь." } },
    howto: {
      rule1: "В каждой <b>цветной области</b> спрятан ровно <b>один самоцвет</b>.",
      rule2: "В каждой <b>строке</b> и каждом <b>столбце</b> тоже ровно один самоцвет.",
      rule3: "Два самоцвета <b>никогда не касаются</b> – даже по диагонали.",
      rule4: "<b>Нажатие</b>: пусто → крестик (заметка «не здесь») → самоцвет → пусто. <b>Проведи</b> по клеткам, чтобы поставить много крестиков сразу.",
      rule5: "Противоречащие самоцветы светятся <b>красным</b>. Жизнь теряется, только когда все самоцветы стоят, а решение не сходится.",
      rule6: "У каждой головоломки одно решение, и она решается <b>без угадывания</b>. Если поле увеличено, двигай его <b>двумя пальцами</b>.",
    },
    soloInvite: { shareText: "Сыграй со мной в Gem Hunt! Присоединяйся к моей игре – код комнаты: {code}" },
    prestige: { master: { desc: "Высший значок — открывается, когда ВСЕ 12 значков легендарные. Доказательство, что ты освоил Gem Hunt." } },
  },
};
