// games/rectangles/i18n.js — die TEXTE, die „Rectangles" anders braucht als
// die gemeinsame Schale: eigene Schlüssel (rect.*) und abweichende Fassungen
// (Anleitung, Einladungstext, Meister-Abzeichen). Liegt als Ebene ÜBER den
// gemeinsamen Texten (js/i18n/), solange Rectangles das aktive Spiel ist —
// s. setGameMessages. Jede Sprache trägt dieselben Schlüssel (Unit-Test).

export default {
  de: {
    rect: {
      boardLabel: 'Spielfeld: Rechtecke ziehen',
      train: {
        title: "Die {n}",
        single: "Für die {n} passt nur noch ein einziges Rechteck – jede andere Form stößt an eine andere Zahl, an den Rand oder an ein fertiges Rechteck.",
        onlyclue: "Eine Zelle hier kann nur noch die {n} erreichen. Nur eine Form der {n} schließt sie ein – also liegt das Rechteck genau so.",
      },
    },
    howto: {
      rule1: 'Teile das ganze Feld in <b>Rechtecke</b> (auch Quadrate) auf: auf einer Zelle <b>aufsetzen und ziehen</b> – beim Loslassen rastet das Rechteck auf den Zellen ein.',
      rule2: 'In jedem Rechteck steht <b>genau eine Zahl</b>, und sie sagt, aus <b>wie vielen Zellen</b> es besteht. Eine <b>6</b> braucht also 2×3, 3×2, 1×6 oder 6×1.',
      rule3: '<b>Jede Zelle</b> gehört zu genau einem Rechteck – am Ende bleibt nichts frei.',
      rule4: 'Kurz auf ein Rechteck <b>tippen</b> entfernt es. Ziehst du ein neues über bestehende, <b>ersetzt</b> es sie.',
      rule5: 'Ist das Brett <b>gezoomt</b>, verschiebst du es mit <b>zwei Fingern</b>.',
      rule6: 'Jedes Rätsel ist <b>ohne Raten</b> eindeutig lösbar. Beim Zeichnen gibt es keine Fehler – erst wenn <b>jede Zelle bedeckt</b> ist und es nicht aufgeht, kostet das ein Leben. Welches Rechteck falsch liegt, findest du selbst heraus.',
    },
    soloInvite: { shareText: 'Spiel mit mir Rectangles! Tritt meinem laufenden Spiel bei – Raumcode: {code}' },
    prestige: { master: { desc: 'Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Rectangles gemeistert hast.' } },
  },
  en: {
    rect: {
      boardLabel: 'Board: drag rectangles',
      train: {
        title: "The {n}",
        single: "Only one rectangle still fits the {n} – every other shape runs into another number, the edge or a finished rectangle.",
        onlyclue: "One cell here can only be reached by the {n}. Only one shape of the {n} covers it – so that is where the rectangle goes.",
      },
    },
    howto: {
      rule1: 'Split the whole board into <b>rectangles</b> (squares count too): <b>touch a cell and drag</b> – when you let go, the rectangle snaps to the cells.',
      rule2: 'Every rectangle contains <b>exactly one number</b>, and it tells <b>how many cells</b> the rectangle has. A <b>6</b> needs 2×3, 3×2, 1×6 or 6×1.',
      rule3: '<b>Every cell</b> belongs to exactly one rectangle – nothing is left over.',
      rule4: '<b>Tap</b> a rectangle to remove it. Drawing a new one over existing ones <b>replaces</b> them.',
      rule5: 'When the board is <b>zoomed</b>, move it with <b>two fingers</b>.',
      rule6: 'Every puzzle has exactly one solution, reachable <b>without guessing</b>. Drawing never counts as a mistake – only when <b>every cell is covered</b> and it does not add up does it cost a life. Finding the wrong rectangle is up to you.',
    },
    soloInvite: { shareText: 'Play Rectangles with me! Join my running game – room code: {code}' },
    prestige: { master: { desc: 'The ultimate badge — unlocked when ALL 12 badges are Legendary. Proof that you have mastered Rectangles.' } },
  },
  es: {
    rect: {
      boardLabel: 'Tablero: arrastra rectángulos',
      train: {
        title: "El {n}",
        single: "Al {n} solo le cabe un rectángulo: cualquier otra forma choca con otro número, con el borde o con un rectángulo terminado.",
        onlyclue: "Una celda de aquí solo la alcanza el {n}. Solo una forma del {n} la incluye, así que el rectángulo va justo ahí.",
      },
    },
    howto: {
      rule1: 'Divide todo el tablero en <b>rectángulos</b> (también cuadrados): <b>toca una celda y arrastra</b>; al soltar, el rectángulo se ajusta a las celdas.',
      rule2: 'Cada rectángulo contiene <b>exactamente un número</b>, que indica <b>cuántas celdas</b> tiene. Un <b>6</b> necesita 2×3, 3×2, 1×6 o 6×1.',
      rule3: '<b>Cada celda</b> pertenece a un solo rectángulo; al final no queda nada libre.',
      rule4: '<b>Toca</b> un rectángulo para quitarlo. Si dibujas uno nuevo encima de otros, los <b>reemplaza</b>.',
      rule5: 'Si el tablero está <b>ampliado</b>, muévelo con <b>dos dedos</b>.',
      rule6: 'Cada puzle tiene una única solución <b>sin adivinar</b>. Dibujar nunca es un error: solo cuando <b>todas las celdas están cubiertas</b> y no cuadra, pierdes una vida. Descubrir qué rectángulo está mal es cosa tuya.',
    },
    soloInvite: { shareText: '¡Juega Rectangles conmigo! Únete a mi partida – código de sala: {code}' },
    prestige: { master: { desc: 'La insignia definitiva: se desbloquea cuando TODAS las 12 insignias son legendarias. La prueba de que dominas Rectangles.' } },
  },
  fr: {
    rect: {
      boardLabel: 'Grille : trace des rectangles',
      train: {
        title: "Le {n}",
        single: "Un seul rectangle convient encore au {n} : toute autre forme bute sur un autre nombre, le bord ou un rectangle terminé.",
        onlyclue: "Une case ici ne peut plus être atteinte que par le {n}. Une seule forme du {n} la contient : le rectangle se place donc ainsi.",
      },
    },
    howto: {
      rule1: 'Découpe toute la grille en <b>rectangles</b> (les carrés comptent aussi) : <b>pose le doigt sur une case et glisse</b> – en relâchant, le rectangle se cale sur les cases.',
      rule2: 'Chaque rectangle contient <b>exactement un nombre</b>, qui indique <b>combien de cases</b> il compte. Un <b>6</b> demande 2×3, 3×2, 1×6 ou 6×1.',
      rule3: '<b>Chaque case</b> appartient à un seul rectangle – à la fin, rien ne reste libre.',
      rule4: '<b>Touche</b> un rectangle pour le retirer. En traçant un nouveau par-dessus d’autres, il les <b>remplace</b>.',
      rule5: 'Si la grille est <b>zoomée</b>, déplace-la avec <b>deux doigts</b>.',
      rule6: 'Chaque grille a une seule solution, <b>sans deviner</b>. Tracer n’est jamais une erreur : c’est seulement quand <b>toutes les cases sont couvertes</b> et que ça ne tombe pas juste que tu perds une vie. À toi de trouver le rectangle faux.',
    },
    soloInvite: { shareText: 'Joue à Rectangles avec moi ! Rejoins ma partie – code du salon : {code}' },
    prestige: { master: { desc: 'Le badge ultime — débloqué quand LES 12 badges sont Légendaires. La preuve que tu maîtrises Rectangles.' } },
  },
  'pt-BR': {
    rect: {
      boardLabel: 'Tabuleiro: arraste retângulos',
      train: {
        title: "O {n}",
        single: "Só cabe mais um retângulo para o {n} – qualquer outra forma esbarra em outro número, na borda ou num retângulo pronto.",
        onlyclue: "Uma célula aqui só pode ser alcançada pelo {n}. Só uma forma do {n} a inclui – então o retângulo fica exatamente assim.",
      },
    },
    howto: {
      rule1: 'Divida o tabuleiro inteiro em <b>retângulos</b> (quadrados também valem): <b>toque numa célula e arraste</b> – ao soltar, o retângulo se encaixa nas células.',
      rule2: 'Cada retângulo contém <b>exatamente um número</b>, que diz <b>quantas células</b> ele tem. Um <b>6</b> precisa de 2×3, 3×2, 1×6 ou 6×1.',
      rule3: '<b>Cada célula</b> pertence a um único retângulo – no fim, nada fica livre.',
      rule4: '<b>Toque</b> num retângulo para removê-lo. Desenhar um novo por cima de outros os <b>substitui</b>.',
      rule5: 'Com o tabuleiro <b>ampliado</b>, mova-o com <b>dois dedos</b>.',
      rule6: 'Cada quebra-cabeça tem uma única solução, <b>sem chutar</b>. Desenhar nunca é erro – só quando <b>todas as células estão cobertas</b> e não fecha, você perde uma vida. Descobrir o retângulo errado é com você.',
    },
    soloInvite: { shareText: 'Jogue Rectangles comigo! Entre na minha partida – código da sala: {code}' },
    prestige: { master: { desc: 'O emblema definitivo — liberado quando TODOS os 12 emblemas estão Lendários. A prova de que você domina Rectangles.' } },
  },
  it: {
    rect: {
      boardLabel: 'Griglia: trascina rettangoli',
      train: {
        title: "Il {n}",
        single: "Per il {n} resta un solo rettangolo possibile: ogni altra forma urta un altro numero, il bordo o un rettangolo già fatto.",
        onlyclue: "Una cella qui può essere raggiunta solo dal {n}. Una sola forma del {n} la include: il rettangolo va proprio così.",
      },
    },
    howto: {
      rule1: 'Dividi tutta la griglia in <b>rettangoli</b> (valgono anche i quadrati): <b>tocca una cella e trascina</b> – al rilascio il rettangolo si aggancia alle celle.',
      rule2: 'Ogni rettangolo contiene <b>esattamente un numero</b>, che indica <b>quante celle</b> ha. Un <b>6</b> richiede 2×3, 3×2, 1×6 o 6×1.',
      rule3: '<b>Ogni cella</b> appartiene a un solo rettangolo: alla fine non resta nulla di libero.',
      rule4: '<b>Tocca</b> un rettangolo per toglierlo. Disegnandone uno nuovo sopra altri, li <b>sostituisce</b>.',
      rule5: 'Se la griglia è <b>ingrandita</b>, spostala con <b>due dita</b>.',
      rule6: 'Ogni puzzle ha un’unica soluzione, <b>senza tirare a indovinare</b>. Disegnare non è mai un errore: solo quando <b>tutte le celle sono coperte</b> e non torna perdi una vita. Trovare il rettangolo sbagliato tocca a te.',
    },
    soloInvite: { shareText: 'Gioca a Rectangles con me! Entra nella mia partita – codice stanza: {code}' },
    prestige: { master: { desc: 'Il distintivo definitivo — si sblocca quando TUTTI i 12 distintivi sono Leggendari. La prova che padroneggi Rectangles.' } },
  },
  ja: {
    rect: {
      boardLabel: '盤面：長方形をドラッグ',
      train: {
        title: "{n}",
        single: "{n} に入る長方形は1つしか残っていません。ほかの形はどれも別の数字・端・完成した長方形にぶつかります。",
        onlyclue: "ここのマスに届くのは {n} だけです。そのマスを含む {n} の形は1つしかないので、長方形はこの位置です。",
      },
    },
    howto: {
      rule1: '盤面全体を<b>長方形</b>（正方形も可）に分けます。<b>マスに触れてドラッグ</b>し、指を離すとマスにぴったり合わせて確定します。',
      rule2: 'どの長方形にも<b>数字がちょうど1つ</b>入り、その数字は長方形の<b>マスの数</b>です。<b>6</b>なら 2×3・3×2・1×6・6×1 のどれかです。',
      rule3: '<b>すべてのマス</b>がちょうど1つの長方形に属し、最後に空きは残りません。',
      rule4: '長方形を<b>タップ</b>すると消えます。既存の長方形の上に新しく描くと<b>置き換わり</b>ます。',
      rule5: '盤面を<b>拡大</b>しているときは、<b>2本指</b>で動かします。',
      rule6: 'どの問題も<b>当て推量なし</b>で解ける答えが1つだけあります。描く途中はミスになりません。<b>全マスが埋まって</b>も合わないときだけライフが1つ減ります。どれが違うかは自分で見つけてください。',
    },
    soloInvite: { shareText: '一緒に Rectangles をプレイしよう！進行中のゲームに参加して – ルームコード: {code}' },
    prestige: { master: { desc: '究極のバッジ — 12個すべてのバッジがレジェンドになると解除。Rectangles を極めた証です。' } },
  },
  ko: {
    rect: {
      boardLabel: '판: 직사각형 끌기',
      train: {
        title: "{n}",
        single: "{n}에 맞는 직사각형은 하나뿐입니다. 다른 모양은 모두 다른 숫자, 가장자리, 완성된 직사각형에 부딪힙니다.",
        onlyclue: "여기 한 칸은 {n}만 닿을 수 있습니다. 그 칸을 포함하는 {n}의 모양은 하나뿐이니, 직사각형은 바로 여기입니다.",
      },
    },
    howto: {
      rule1: '판 전체를 <b>직사각형</b>(정사각형 포함)으로 나누세요. <b>칸을 누르고 끌면</b> 되고, 손을 떼면 칸에 맞춰 고정됩니다.',
      rule2: '모든 직사각형에는 <b>숫자가 정확히 하나</b> 있고, 그 숫자는 직사각형의 <b>칸 수</b>입니다. <b>6</b>이면 2×3, 3×2, 1×6, 6×1 중 하나입니다.',
      rule3: '<b>모든 칸</b>은 정확히 하나의 직사각형에 속합니다. 마지막에 빈칸이 남지 않습니다.',
      rule4: '직사각형을 <b>탭</b>하면 지워집니다. 기존 직사각형 위에 새로 그리면 <b>대체</b>됩니다.',
      rule5: '판을 <b>확대</b>했을 때는 <b>두 손가락</b>으로 움직이세요.',
      rule6: '모든 퍼즐은 <b>추측 없이</b> 풀 수 있는 해답이 하나뿐입니다. 그리는 중에는 실수가 없고, <b>모든 칸이 덮였는데</b> 맞지 않을 때만 생명이 하나 줄어듭니다. 어느 직사각형이 틀렸는지는 직접 찾아야 합니다.',
    },
    soloInvite: { shareText: '같이 Rectangles 하자! 진행 중인 게임에 참여해 – 방 코드: {code}' },
    prestige: { master: { desc: '궁극의 배지 — 12개 배지가 모두 전설이 되면 해제됩니다. Rectangles를 정복했다는 증거입니다.' } },
  },
  tr: {
    rect: {
      boardLabel: 'Tahta: dikdörtgen sürükle',
      train: {
        title: "{n}",
        single: "{n} için yalnızca tek bir dikdörtgen kaldı – başka her şekil başka bir sayıya, kenara ya da bitmiş bir dikdörtgene çarpıyor.",
        onlyclue: "Buradaki bir hücreye yalnızca {n} ulaşabiliyor. Onu içeren tek bir {n} şekli var – dikdörtgen tam burada.",
      },
    },
    howto: {
      rule1: 'Tüm tahtayı <b>dikdörtgenlere</b> (kareler de olur) böl: <b>bir hücreye dokun ve sürükle</b> – bırakınca dikdörtgen hücrelere oturur.',
      rule2: 'Her dikdörtgende <b>tam bir sayı</b> bulunur ve bu sayı dikdörtgenin <b>kaç hücreden</b> oluştuğunu söyler. Bir <b>6</b> için 2×3, 3×2, 1×6 veya 6×1 gerekir.',
      rule3: '<b>Her hücre</b> tam olarak bir dikdörtgene aittir – sonunda boş yer kalmaz.',
      rule4: 'Bir dikdörtgene <b>dokunmak</b> onu kaldırır. Mevcutların üzerine yenisini çizersen onların <b>yerini alır</b>.',
      rule5: 'Tahta <b>yakınlaştırılmışsa</b> onu <b>iki parmakla</b> kaydır.',
      rule6: 'Her bulmacanın <b>tahmin etmeden</b> bulunabilen tek bir çözümü vardır. Çizmek asla hata sayılmaz – yalnızca <b>tüm hücreler kaplandığında</b> tutmazsa bir can gider. Yanlış dikdörtgeni bulmak sana kalmış.',
    },
    soloInvite: { shareText: 'Benimle Rectangles oyna! Devam eden oyunuma katıl – oda kodu: {code}' },
    prestige: { master: { desc: 'Nihai rozet — 12 rozetin TAMAMI Efsanevi olduğunda açılır. Rectangles’ta ustalaştığının kanıtı.' } },
  },
  ru: {
    rect: {
      boardLabel: 'Поле: рисуй прямоугольники',
      train: {
        title: "Число {n}",
        single: "Для {n} подходит лишь один прямоугольник — любая другая форма упирается в другое число, в край или в готовый прямоугольник.",
        onlyclue: "До одной клетки здесь может дотянуться только {n}. Её включает лишь одна форма для {n} — значит, прямоугольник лежит именно так.",
      },
    },
    howto: {
      rule1: 'Раздели всё поле на <b>прямоугольники</b> (квадраты тоже подходят): <b>коснись клетки и тяни</b> — когда отпустишь, прямоугольник встанет точно по клеткам.',
      rule2: 'В каждом прямоугольнике <b>ровно одно число</b>, и оно показывает, <b>сколько клеток</b> в нём. Для <b>6</b> нужен 2×3, 3×2, 1×6 или 6×1.',
      rule3: '<b>Каждая клетка</b> принадлежит ровно одному прямоугольнику — в конце ничего не остаётся свободным.',
      rule4: '<b>Касание</b> прямоугольника удаляет его. Новый прямоугольник поверх старых их <b>заменяет</b>.',
      rule5: 'Если поле <b>увеличено</b>, двигай его <b>двумя пальцами</b>.',
      rule6: 'У каждой головоломки одно решение, и оно находится <b>без угадывания</b>. Рисование никогда не считается ошибкой — жизнь теряется, только когда <b>все клетки покрыты</b>, а решение не сходится. Найти неверный прямоугольник — твоя задача.',
    },
    soloInvite: { shareText: 'Сыграй со мной в Rectangles! Присоединяйся к моей игре — код комнаты: {code}' },
    prestige: { master: { desc: 'Высший значок — открывается, когда ВСЕ 12 значков легендарные. Доказательство, что ты освоил Rectangles.' } },
  },
};
