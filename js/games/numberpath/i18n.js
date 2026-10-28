// games/numberpath/i18n.js — die TEXTE, die „Number Path" anders braucht als
// die gemeinsame Schale: eigene Schlüssel (np.*) und abweichende Fassungen
// (Anleitung, Einladungstext, Meister-Abzeichen). Ebene ÜBER den gemeinsamen
// Texten, solange Number Path aktiv ist (s. setGameMessages). Jede Sprache trägt
// dieselben Schlüssel.

export default {
  de: {
    np: { boardLabel: "Spielfeld: Linie ziehen", train: { title: "Nächster Schritt", start: "Die Linie beginnt auf der 1.", onlyway: "Von hier aus bleibt nur ein einziger freier Weg.", logic: "Jeder andere Weg würde eine Zelle abschneiden, eine Sackgasse erzeugen oder die Reihenfolge der Zahlen brechen." } },
    howto: {
      rule1: "Zeichne <b>eine durchgehende Linie</b>: auf der <b>1</b> aufsetzen und ziehen – waagerecht oder senkrecht von Zelle zu Zelle.",
      rule2: "Die Linie erreicht die Zahlen <b>der Reihe nach</b> (1 → 2 → 3 …) und endet auf der <b>höchsten Zahl</b>.",
      rule3: "<b>Jede Zelle</b> wird genau einmal belegt – die Linie kreuzt sich nie, und am Ende bleibt nichts frei.",
      rule4: "<b>Dicke Striche</b> sind Wände – dort kommt die Linie nicht durch.",
      rule5: "Zum Korrigieren auf eine Stelle der Linie tippen oder <b>zurückziehen</b> – sie wird dort gekürzt. Ist das Brett gezoomt, verschiebst du es mit <b>zwei Fingern</b>.",
      rule6: "Eine Zahl außer der Reihe, eine Wand oder eine belegte Zelle sind einfach <b>gesperrt</b> – das kostet nichts. Jedes Rätsel hat genau eine Lösung und ist <b>ohne Raten</b> lösbar.",
    },
    soloInvite: { shareText: "Spiel mit mir Number Path! Tritt meinem laufenden Spiel bei – Raumcode: {code}" },
    prestige: { master: { desc: "Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Number Path gemeistert hast." } },
  },
  en: {
    np: { boardLabel: "Board: draw the line", train: { title: "Next step", start: "The line starts on the 1.", onlyway: "From here only one free way is left.", logic: "Any other way would cut off a cell, create a dead end or break the order of the numbers." } },
    howto: {
      rule1: "Draw <b>one continuous line</b>: touch the <b>1</b> and drag – horizontally or vertically from cell to cell.",
      rule2: "The line reaches the numbers <b>in order</b> (1 → 2 → 3 …) and ends on the <b>highest number</b>.",
      rule3: "<b>Every cell</b> is used exactly once – the line never crosses itself and nothing is left over.",
      rule4: "<b>Thick bars</b> are walls – the line cannot pass them.",
      rule5: "To correct, tap a point on the line or <b>drag back</b> – it is cut there. When the board is zoomed, move it with <b>two fingers</b>.",
      rule6: "A number out of order, a wall or a used cell is simply <b>blocked</b> – it costs nothing. Every puzzle has exactly one solution, reachable <b>without guessing</b>.",
    },
    soloInvite: { shareText: "Play Number Path with me! Join my running game – room code: {code}" },
    prestige: { master: { desc: "The ultimate badge — unlocked when ALL 12 badges are Legendary. Proof that you have mastered Number Path." } },
  },
  es: {
    np: { boardLabel: "Tablero: dibuja la línea", train: { title: "Siguiente paso", start: "La línea empieza en el 1.", onlyway: "Desde aquí solo queda un camino libre.", logic: "Cualquier otro camino aislaría una celda, crearía un callejón sin salida o rompería el orden de los números." } },
    howto: {
      rule1: "Dibuja <b>una línea continua</b>: toca el <b>1</b> y arrastra, en horizontal o vertical de celda en celda.",
      rule2: "La línea alcanza los números <b>en orden</b> (1 → 2 → 3 …) y termina en el <b>número más alto</b>.",
      rule3: "<b>Cada celda</b> se usa exactamente una vez: la línea nunca se cruza y no queda nada libre.",
      rule4: "Las <b>barras gruesas</b> son paredes: la línea no puede atravesarlas.",
      rule5: "Para corregir, toca un punto de la línea o <b>arrastra hacia atrás</b>: se corta ahí. Con el tablero ampliado, muévelo con <b>dos dedos</b>.",
      rule6: "Un número fuera de orden, una pared o una celda ocupada simplemente están <b>bloqueados</b>: no cuesta nada. Cada puzle tiene una única solución <b>sin adivinar</b>.",
    },
    soloInvite: { shareText: "¡Juega Number Path conmigo! Únete a mi partida – código de sala: {code}" },
    prestige: { master: { desc: "La insignia definitiva: se desbloquea cuando TODAS las 12 insignias son legendarias. La prueba de que dominas Number Path." } },
  },
  fr: {
    np: { boardLabel: "Grille : trace la ligne", train: { title: "Étape suivante", start: "La ligne commence sur le 1.", onlyway: "D’ici, il ne reste qu’un seul chemin libre.", logic: "Tout autre chemin isolerait une case, créerait une impasse ou briserait l’ordre des nombres." } },
    howto: {
      rule1: "Trace <b>une seule ligne continue</b> : pose le doigt sur le <b>1</b> et glisse – horizontalement ou verticalement de case en case.",
      rule2: "La ligne atteint les nombres <b>dans l’ordre</b> (1 → 2 → 3 …) et finit sur le <b>plus grand nombre</b>.",
      rule3: "<b>Chaque case</b> est utilisée exactement une fois – la ligne ne se croise jamais et rien ne reste libre.",
      rule4: "Les <b>traits épais</b> sont des murs – la ligne ne peut pas les franchir.",
      rule5: "Pour corriger, touche un point de la ligne ou <b>reviens en arrière</b> – elle est coupée là. Si la grille est zoomée, déplace-la avec <b>deux doigts</b>.",
      rule6: "Un nombre hors ordre, un mur ou une case occupée sont simplement <b>bloqués</b> – cela ne coûte rien. Chaque grille a une seule solution, <b>sans deviner</b>.",
    },
    soloInvite: { shareText: "Joue à Number Path avec moi ! Rejoins ma partie – code du salon : {code}" },
    prestige: { master: { desc: "Le badge ultime — débloqué quand LES 12 badges sont Légendaires. La preuve que tu maîtrises Number Path." } },
  },
  'pt-BR': {
    np: { boardLabel: "Tabuleiro: desenhe a linha", train: { title: "Próximo passo", start: "A linha começa no 1.", onlyway: "Daqui só resta um caminho livre.", logic: "Qualquer outro caminho isolaria uma célula, criaria um beco sem saída ou quebraria a ordem dos números." } },
    howto: {
      rule1: "Desenhe <b>uma linha contínua</b>: toque no <b>1</b> e arraste – na horizontal ou vertical, de célula em célula.",
      rule2: "A linha passa pelos números <b>em ordem</b> (1 → 2 → 3 …) e termina no <b>maior número</b>.",
      rule3: "<b>Cada célula</b> é usada exatamente uma vez – a linha nunca se cruza e nada fica livre.",
      rule4: "<b>Barras grossas</b> são paredes – a linha não passa por elas.",
      rule5: "Para corrigir, toque num ponto da linha ou <b>arraste de volta</b> – ela é cortada ali. Com o tabuleiro ampliado, mova-o com <b>dois dedos</b>.",
      rule6: "Um número fora de ordem, uma parede ou uma célula ocupada ficam simplesmente <b>bloqueados</b> – não custa nada. Cada quebra-cabeça tem uma única solução, <b>sem chutar</b>.",
    },
    soloInvite: { shareText: "Jogue Number Path comigo! Entre na minha partida – código da sala: {code}" },
    prestige: { master: { desc: "O emblema definitivo — liberado quando TODOS os 12 emblemas estão Lendários. A prova de que você domina Number Path." } },
  },
  it: {
    np: { boardLabel: "Griglia: traccia la linea", train: { title: "Prossimo passo", start: "La linea parte dall’1.", onlyway: "Da qui resta una sola strada libera.", logic: "Ogni altra strada isolerebbe una cella, creerebbe un vicolo cieco o romperebbe l’ordine dei numeri." } },
    howto: {
      rule1: "Traccia <b>una linea continua</b>: tocca l’<b>1</b> e trascina, in orizzontale o in verticale di cella in cella.",
      rule2: "La linea raggiunge i numeri <b>in ordine</b> (1 → 2 → 3 …) e finisce sul <b>numero più alto</b>.",
      rule3: "<b>Ogni cella</b> è usata esattamente una volta: la linea non si incrocia mai e non resta nulla di libero.",
      rule4: "Le <b>barre spesse</b> sono muri: la linea non le attraversa.",
      rule5: "Per correggere, tocca un punto della linea o <b>torna indietro</b>: viene accorciata lì. Con la griglia ingrandita, spostala con <b>due dita</b>.",
      rule6: "Un numero fuori ordine, un muro o una cella occupata sono semplicemente <b>bloccati</b>: non costa nulla. Ogni puzzle ha un’unica soluzione, <b>senza tirare a indovinare</b>.",
    },
    soloInvite: { shareText: "Gioca a Number Path con me! Entra nella mia partita – codice stanza: {code}" },
    prestige: { master: { desc: "Il distintivo definitivo — si sblocca quando TUTTI i 12 distintivi sono Leggendari. La prova che padroneggi Number Path." } },
  },
  ja: {
    np: { boardLabel: "盤面：線を引く", train: { title: "次の一手", start: "線は 1 から始まります。", onlyway: "ここからは空いている道が1つしかありません。", logic: "ほかの道を選ぶと、マスが孤立したり、行き止まりができたり、数字の順番が崩れたりします。" } },
    howto: {
      rule1: "<b>一本の連続した線</b>を引きます。<b>1</b> に触れてドラッグし、縦か横にマスからマスへ進みます。",
      rule2: "線は数字を<b>順番に</b>（1 → 2 → 3 …）通り、<b>いちばん大きい数字</b>で終わります。",
      rule3: "<b>すべてのマス</b>をちょうど1回ずつ通ります。線は交差せず、最後に空きは残りません。",
      rule4: "<b>太い線</b>は壁です。線はそこを通れません。",
      rule5: "直すときは線の途中をタップするか<b>戻るように</b>なぞると、そこで短くなります。拡大中は<b>2本指</b>で盤面を動かせます。",
      rule6: "順番外の数字・壁・通ったマスへは<b>進めない</b>だけで、ペナルティはありません。どの問題も<b>当て推量なし</b>で解ける答えが1つだけです。",
    },
    soloInvite: { shareText: "一緒に Number Path をプレイしよう！進行中のゲームに参加して – ルームコード: {code}" },
    prestige: { master: { desc: "究極のバッジ — 12個すべてのバッジがレジェンドになると解除。Number Path を極めた証です。" } },
  },
  ko: {
    np: { boardLabel: "판: 선 긋기", train: { title: "다음 단계", start: "선은 1에서 시작합니다.", onlyway: "여기서는 비어 있는 길이 하나뿐입니다.", logic: "다른 길로 가면 칸이 고립되거나, 막다른 길이 생기거나, 숫자 순서가 깨집니다." } },
    howto: {
      rule1: "<b>끊기지 않는 선 하나</b>를 그립니다. <b>1</b>을 누르고 끌어 가로나 세로로 칸에서 칸으로 이동하세요.",
      rule2: "선은 숫자를 <b>순서대로</b>(1 → 2 → 3 …) 지나 <b>가장 큰 숫자</b>에서 끝납니다.",
      rule3: "<b>모든 칸</b>을 정확히 한 번씩 지납니다. 선은 교차하지 않고, 마지막에 빈칸이 남지 않습니다.",
      rule4: "<b>굵은 선</b>은 벽입니다. 선이 지나갈 수 없습니다.",
      rule5: "고치려면 선의 한 지점을 탭하거나 <b>되돌아가며</b> 끌면 거기서 잘립니다. 확대했을 때는 <b>두 손가락</b>으로 움직이세요.",
      rule6: "순서가 아닌 숫자, 벽, 이미 지난 칸은 그냥 <b>막혀</b> 있고 벌점은 없습니다. 모든 퍼즐은 <b>추측 없이</b> 풀 수 있는 해답이 하나뿐입니다.",
    },
    soloInvite: { shareText: "같이 Number Path 하자! 진행 중인 게임에 참여해 – 방 코드: {code}" },
    prestige: { master: { desc: "궁극의 배지 — 12개 배지가 모두 전설이 되면 해제됩니다. Number Path를 정복했다는 증거입니다." } },
  },
  tr: {
    np: { boardLabel: "Tahta: çizgiyi çiz", train: { title: "Sonraki adım", start: "Çizgi 1’den başlar.", onlyway: "Buradan yalnızca tek bir boş yol kalıyor.", logic: "Başka her yol bir hücreyi ayırır, bir çıkmaz oluşturur ya da sayıların sırasını bozar." } },
    howto: {
      rule1: "<b>Tek, kesintisiz bir çizgi</b> çiz: <b>1</b>’e dokun ve sürükle – yatay ya da dikey olarak hücreden hücreye.",
      rule2: "Çizgi sayılara <b>sırayla</b> uğrar (1 → 2 → 3 …) ve <b>en büyük sayıda</b> biter.",
      rule3: "<b>Her hücre</b> tam bir kez kullanılır – çizgi kendini kesmez ve boş yer kalmaz.",
      rule4: "<b>Kalın çizgiler</b> duvardır – çizgi oradan geçemez.",
      rule5: "Düzeltmek için çizgide bir noktaya dokun ya da <b>geri sürükle</b> – çizgi orada kısalır. Tahta yakınlaştırılmışsa <b>iki parmakla</b> kaydır.",
      rule6: "Sırası gelmemiş sayı, duvar ya da dolu hücre yalnızca <b>engellenir</b> – bir şey kaybettirmez. Her bulmacanın <b>tahmin etmeden</b> bulunabilen tek çözümü vardır.",
    },
    soloInvite: { shareText: "Benimle Number Path oyna! Devam eden oyunuma katıl – oda kodu: {code}" },
    prestige: { master: { desc: "Nihai rozet — 12 rozetin TAMAMI Efsanevi olduğunda açılır. Number Path’te ustalaştığının kanıtı." } },
  },
  ru: {
    np: { boardLabel: "Поле: проведи линию", train: { title: "Следующий шаг", start: "Линия начинается с 1.", onlyway: "Отсюда остаётся только один свободный путь.", logic: "Любой другой путь отрезал бы клетку, создал бы тупик или нарушил порядок чисел." } },
    howto: {
      rule1: "Проведи <b>одну непрерывную линию</b>: коснись <b>1</b> и тяни — по горизонтали или вертикали от клетки к клетке.",
      rule2: "Линия проходит числа <b>по порядку</b> (1 → 2 → 3 …) и заканчивается на <b>самом большом числе</b>.",
      rule3: "<b>Каждая клетка</b> используется ровно один раз — линия не пересекается, и в конце ничего не остаётся свободным.",
      rule4: "<b>Толстые полосы</b> — это стены, через них линия не проходит.",
      rule5: "Чтобы исправить, коснись точки на линии или <b>потяни назад</b> — она укоротится там. Если поле увеличено, двигай его <b>двумя пальцами</b>.",
      rule6: "Число не по порядку, стена или занятая клетка просто <b>заблокированы</b> — это ничего не стоит. У каждой головоломки одно решение, и оно находится <b>без угадывания</b>.",
    },
    soloInvite: { shareText: "Сыграй со мной в Number Path! Присоединяйся к моей игре — код комнаты: {code}" },
    prestige: { master: { desc: "Высший значок — открывается, когда ВСЕ 12 значков легендарные. Доказательство, что ты освоил Number Path." } },
  },
};
