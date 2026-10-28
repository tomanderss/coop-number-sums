// games/rectangles/i18n.js — die TEXTE, die „Rectangles" anders braucht als
// die gemeinsame Schale: eigene Schlüssel (rect.*) und abweichende Fassungen
// (Anleitung, Einladungstext, Meister-Abzeichen). Liegt als Ebene ÜBER den
// gemeinsamen Texten (js/i18n/), solange Rectangles das aktive Spiel ist —
// s. setGameMessages. Jede Sprache trägt dieselben Schlüssel (Unit-Test).

export default {
  de: {
    rect: {
      howto: 'Ziehen zeichnet ein Rechteck · Tippen entfernt es',
      fullWrong: 'Geht nicht auf – irgendein Rechteck liegt falsch',
      boardLabel: 'Spielfeld: Rechtecke ziehen',
      undo: 'Rückgängig',
    },
    howto: {
      rule1: 'Teile das ganze Feld in <b>Rechtecke</b> (auch Quadrate) auf: auf einer Zelle <b>aufsetzen und ziehen</b> – beim Loslassen rastet das Rechteck auf den Zellen ein.',
      rule2: 'In jedem Rechteck steht <b>genau eine Zahl</b>, und sie sagt, aus <b>wie vielen Zellen</b> es besteht. Eine <b>6</b> braucht also 2×3, 3×2, 1×6 oder 6×1.',
      rule3: '<b>Jede Zelle</b> gehört zu genau einem Rechteck – am Ende bleibt nichts frei.',
      rule4: 'Kurz auf ein Rechteck <b>tippen</b> entfernt es. Ziehst du ein neues über bestehende, <b>ersetzt</b> es sie. Der <b>Rückgängig</b>-Knopf oben nimmt deinen letzten Zug zurück.',
      rule5: 'Ist das Brett <b>gezoomt</b>, verschiebst du es mit <b>zwei Fingern</b>.',
      rule6: 'Jedes Rätsel ist <b>ohne Raten</b> eindeutig lösbar. Beim Zeichnen gibt es keine Fehler – erst wenn <b>jede Zelle bedeckt</b> ist und es nicht aufgeht, kostet das ein Leben. Welches Rechteck falsch liegt, findest du selbst heraus.',
    },
    soloInvite: { shareText: 'Spiel mit mir Rectangles! Tritt meinem laufenden Spiel bei – Raumcode: {code}' },
    prestige: { master: { desc: 'Das ultimative Abzeichen — freigeschaltet, wenn ALLE 12 Abzeichen auf Legendär stehen. Der Beweis, dass du Rectangles gemeistert hast.' } },
  },
  en: {
    rect: {
      howto: 'Drag to draw a rectangle · tap to remove it',
      fullWrong: "Doesn't add up – some rectangle is wrong",
      boardLabel: 'Board: drag rectangles',
      undo: 'Undo',
    },
    howto: {
      rule1: 'Split the whole board into <b>rectangles</b> (squares count too): <b>touch a cell and drag</b> – when you let go, the rectangle snaps to the cells.',
      rule2: 'Every rectangle contains <b>exactly one number</b>, and it tells <b>how many cells</b> the rectangle has. A <b>6</b> needs 2×3, 3×2, 1×6 or 6×1.',
      rule3: '<b>Every cell</b> belongs to exactly one rectangle – nothing is left over.',
      rule4: '<b>Tap</b> a rectangle to remove it. Drawing a new one over existing ones <b>replaces</b> them. The <b>Undo</b> button at the top takes back your last move.',
      rule5: 'When the board is <b>zoomed</b>, move it with <b>two fingers</b>.',
      rule6: 'Every puzzle has exactly one solution, reachable <b>without guessing</b>. Drawing never counts as a mistake – only when <b>every cell is covered</b> and it does not add up does it cost a life. Finding the wrong rectangle is up to you.',
    },
    soloInvite: { shareText: 'Play Rectangles with me! Join my running game – room code: {code}' },
    prestige: { master: { desc: 'The ultimate badge — unlocked when ALL 12 badges are Legendary. Proof that you have mastered Rectangles.' } },
  },
  es: {
    rect: {
      howto: 'Arrastra para dibujar un rectángulo · toca para quitarlo',
      fullWrong: 'No cuadra: algún rectángulo está mal',
      boardLabel: 'Tablero: arrastra rectángulos',
      undo: 'Deshacer',
    },
    howto: {
      rule1: 'Divide todo el tablero en <b>rectángulos</b> (también cuadrados): <b>toca una celda y arrastra</b>; al soltar, el rectángulo se ajusta a las celdas.',
      rule2: 'Cada rectángulo contiene <b>exactamente un número</b>, que indica <b>cuántas celdas</b> tiene. Un <b>6</b> necesita 2×3, 3×2, 1×6 o 6×1.',
      rule3: '<b>Cada celda</b> pertenece a un solo rectángulo; al final no queda nada libre.',
      rule4: '<b>Toca</b> un rectángulo para quitarlo. Si dibujas uno nuevo encima de otros, los <b>reemplaza</b>. El botón <b>Deshacer</b> de arriba anula tu último movimiento.',
      rule5: 'Si el tablero está <b>ampliado</b>, muévelo con <b>dos dedos</b>.',
      rule6: 'Cada puzle tiene una única solución <b>sin adivinar</b>. Dibujar nunca es un error: solo cuando <b>todas las celdas están cubiertas</b> y no cuadra, pierdes una vida. Descubrir qué rectángulo está mal es cosa tuya.',
    },
    soloInvite: { shareText: '¡Juega Rectangles conmigo! Únete a mi partida – código de sala: {code}' },
    prestige: { master: { desc: 'La insignia definitiva: se desbloquea cuando TODAS las 12 insignias son legendarias. La prueba de que dominas Rectangles.' } },
  },
  fr: {
    rect: {
      howto: 'Glisse pour tracer un rectangle · touche pour le retirer',
      fullWrong: 'Ça ne tombe pas juste – un rectangle est faux',
      boardLabel: 'Grille : trace des rectangles',
      undo: 'Annuler',
    },
    howto: {
      rule1: 'Découpe toute la grille en <b>rectangles</b> (les carrés comptent aussi) : <b>pose le doigt sur une case et glisse</b> – en relâchant, le rectangle se cale sur les cases.',
      rule2: 'Chaque rectangle contient <b>exactement un nombre</b>, qui indique <b>combien de cases</b> il compte. Un <b>6</b> demande 2×3, 3×2, 1×6 ou 6×1.',
      rule3: '<b>Chaque case</b> appartient à un seul rectangle – à la fin, rien ne reste libre.',
      rule4: '<b>Touche</b> un rectangle pour le retirer. En traçant un nouveau par-dessus d’autres, il les <b>remplace</b>. Le bouton <b>Annuler</b> en haut reprend ton dernier coup.',
      rule5: 'Si la grille est <b>zoomée</b>, déplace-la avec <b>deux doigts</b>.',
      rule6: 'Chaque grille a une seule solution, <b>sans deviner</b>. Tracer n’est jamais une erreur : c’est seulement quand <b>toutes les cases sont couvertes</b> et que ça ne tombe pas juste que tu perds une vie. À toi de trouver le rectangle faux.',
    },
    soloInvite: { shareText: 'Joue à Rectangles avec moi ! Rejoins ma partie – code du salon : {code}' },
    prestige: { master: { desc: 'Le badge ultime — débloqué quand LES 12 badges sont Légendaires. La preuve que tu maîtrises Rectangles.' } },
  },
  'pt-BR': {
    rect: {
      howto: 'Arraste para desenhar um retângulo · toque para removê-lo',
      fullWrong: 'Não fecha – algum retângulo está errado',
      boardLabel: 'Tabuleiro: arraste retângulos',
      undo: 'Desfazer',
    },
    howto: {
      rule1: 'Divida o tabuleiro inteiro em <b>retângulos</b> (quadrados também valem): <b>toque numa célula e arraste</b> – ao soltar, o retângulo se encaixa nas células.',
      rule2: 'Cada retângulo contém <b>exatamente um número</b>, que diz <b>quantas células</b> ele tem. Um <b>6</b> precisa de 2×3, 3×2, 1×6 ou 6×1.',
      rule3: '<b>Cada célula</b> pertence a um único retângulo – no fim, nada fica livre.',
      rule4: '<b>Toque</b> num retângulo para removê-lo. Desenhar um novo por cima de outros os <b>substitui</b>. O botão <b>Desfazer</b> no topo desfaz sua última jogada.',
      rule5: 'Com o tabuleiro <b>ampliado</b>, mova-o com <b>dois dedos</b>.',
      rule6: 'Cada quebra-cabeça tem uma única solução, <b>sem chutar</b>. Desenhar nunca é erro – só quando <b>todas as células estão cobertas</b> e não fecha, você perde uma vida. Descobrir o retângulo errado é com você.',
    },
    soloInvite: { shareText: 'Jogue Rectangles comigo! Entre na minha partida – código da sala: {code}' },
    prestige: { master: { desc: 'O emblema definitivo — liberado quando TODOS os 12 emblemas estão Lendários. A prova de que você domina Rectangles.' } },
  },
  it: {
    rect: {
      howto: 'Trascina per disegnare un rettangolo · tocca per toglierlo',
      fullWrong: 'Non torna: qualche rettangolo è sbagliato',
      boardLabel: 'Griglia: trascina rettangoli',
      undo: 'Annulla',
    },
    howto: {
      rule1: 'Dividi tutta la griglia in <b>rettangoli</b> (valgono anche i quadrati): <b>tocca una cella e trascina</b> – al rilascio il rettangolo si aggancia alle celle.',
      rule2: 'Ogni rettangolo contiene <b>esattamente un numero</b>, che indica <b>quante celle</b> ha. Un <b>6</b> richiede 2×3, 3×2, 1×6 o 6×1.',
      rule3: '<b>Ogni cella</b> appartiene a un solo rettangolo: alla fine non resta nulla di libero.',
      rule4: '<b>Tocca</b> un rettangolo per toglierlo. Disegnandone uno nuovo sopra altri, li <b>sostituisce</b>. Il pulsante <b>Annulla</b> in alto ritira la tua ultima mossa.',
      rule5: 'Se la griglia è <b>ingrandita</b>, spostala con <b>due dita</b>.',
      rule6: 'Ogni puzzle ha un’unica soluzione, <b>senza tirare a indovinare</b>. Disegnare non è mai un errore: solo quando <b>tutte le celle sono coperte</b> e non torna perdi una vita. Trovare il rettangolo sbagliato tocca a te.',
    },
    soloInvite: { shareText: 'Gioca a Rectangles con me! Entra nella mia partita – codice stanza: {code}' },
    prestige: { master: { desc: 'Il distintivo definitivo — si sblocca quando TUTTI i 12 distintivi sono Leggendari. La prova che padroneggi Rectangles.' } },
  },
  ja: {
    rect: {
      howto: 'ドラッグで長方形を描く・タップで消す',
      fullWrong: '合いません ― どこかの長方形が違います',
      boardLabel: '盤面：長方形をドラッグ',
      undo: '元に戻す',
    },
    howto: {
      rule1: '盤面全体を<b>長方形</b>（正方形も可）に分けます。<b>マスに触れてドラッグ</b>し、指を離すとマスにぴったり合わせて確定します。',
      rule2: 'どの長方形にも<b>数字がちょうど1つ</b>入り、その数字は長方形の<b>マスの数</b>です。<b>6</b>なら 2×3・3×2・1×6・6×1 のどれかです。',
      rule3: '<b>すべてのマス</b>がちょうど1つの長方形に属し、最後に空きは残りません。',
      rule4: '長方形を<b>タップ</b>すると消えます。既存の長方形の上に新しく描くと<b>置き換わり</b>ます。上の<b>元に戻す</b>ボタンで直前の手を取り消せます。',
      rule5: '盤面を<b>拡大</b>しているときは、<b>2本指</b>で動かします。',
      rule6: 'どの問題も<b>当て推量なし</b>で解ける答えが1つだけあります。描く途中はミスになりません。<b>全マスが埋まって</b>も合わないときだけライフが1つ減ります。どれが違うかは自分で見つけてください。',
    },
    soloInvite: { shareText: '一緒に Rectangles をプレイしよう！進行中のゲームに参加して – ルームコード: {code}' },
    prestige: { master: { desc: '究極のバッジ — 12個すべてのバッジがレジェンドになると解除。Rectangles を極めた証です。' } },
  },
  ko: {
    rect: {
      howto: '끌어서 직사각형 그리기 · 탭하면 지우기',
      fullWrong: '맞지 않아요 – 어딘가 직사각형이 틀렸어요',
      boardLabel: '판: 직사각형 끌기',
      undo: '되돌리기',
    },
    howto: {
      rule1: '판 전체를 <b>직사각형</b>(정사각형 포함)으로 나누세요. <b>칸을 누르고 끌면</b> 되고, 손을 떼면 칸에 맞춰 고정됩니다.',
      rule2: '모든 직사각형에는 <b>숫자가 정확히 하나</b> 있고, 그 숫자는 직사각형의 <b>칸 수</b>입니다. <b>6</b>이면 2×3, 3×2, 1×6, 6×1 중 하나입니다.',
      rule3: '<b>모든 칸</b>은 정확히 하나의 직사각형에 속합니다. 마지막에 빈칸이 남지 않습니다.',
      rule4: '직사각형을 <b>탭</b>하면 지워집니다. 기존 직사각형 위에 새로 그리면 <b>대체</b>됩니다. 위의 <b>되돌리기</b> 버튼은 마지막 수를 취소합니다.',
      rule5: '판을 <b>확대</b>했을 때는 <b>두 손가락</b>으로 움직이세요.',
      rule6: '모든 퍼즐은 <b>추측 없이</b> 풀 수 있는 해답이 하나뿐입니다. 그리는 중에는 실수가 없고, <b>모든 칸이 덮였는데</b> 맞지 않을 때만 생명이 하나 줄어듭니다. 어느 직사각형이 틀렸는지는 직접 찾아야 합니다.',
    },
    soloInvite: { shareText: '같이 Rectangles 하자! 진행 중인 게임에 참여해 – 방 코드: {code}' },
    prestige: { master: { desc: '궁극의 배지 — 12개 배지가 모두 전설이 되면 해제됩니다. Rectangles를 정복했다는 증거입니다.' } },
  },
  tr: {
    rect: {
      howto: 'Sürükle: dikdörtgen çiz · Dokun: kaldır',
      fullWrong: 'Tutmuyor – bir dikdörtgen yanlış',
      boardLabel: 'Tahta: dikdörtgen sürükle',
      undo: 'Geri al',
    },
    howto: {
      rule1: 'Tüm tahtayı <b>dikdörtgenlere</b> (kareler de olur) böl: <b>bir hücreye dokun ve sürükle</b> – bırakınca dikdörtgen hücrelere oturur.',
      rule2: 'Her dikdörtgende <b>tam bir sayı</b> bulunur ve bu sayı dikdörtgenin <b>kaç hücreden</b> oluştuğunu söyler. Bir <b>6</b> için 2×3, 3×2, 1×6 veya 6×1 gerekir.',
      rule3: '<b>Her hücre</b> tam olarak bir dikdörtgene aittir – sonunda boş yer kalmaz.',
      rule4: 'Bir dikdörtgene <b>dokunmak</b> onu kaldırır. Mevcutların üzerine yenisini çizersen onların <b>yerini alır</b>. Üstteki <b>Geri al</b> düğmesi son hamleni geri alır.',
      rule5: 'Tahta <b>yakınlaştırılmışsa</b> onu <b>iki parmakla</b> kaydır.',
      rule6: 'Her bulmacanın <b>tahmin etmeden</b> bulunabilen tek bir çözümü vardır. Çizmek asla hata sayılmaz – yalnızca <b>tüm hücreler kaplandığında</b> tutmazsa bir can gider. Yanlış dikdörtgeni bulmak sana kalmış.',
    },
    soloInvite: { shareText: 'Benimle Rectangles oyna! Devam eden oyunuma katıl – oda kodu: {code}' },
    prestige: { master: { desc: 'Nihai rozet — 12 rozetin TAMAMI Efsanevi olduğunda açılır. Rectangles’ta ustalaştığının kanıtı.' } },
  },
  ru: {
    rect: {
      howto: 'Тяни, чтобы нарисовать прямоугольник · касание удаляет',
      fullWrong: 'Не сходится — какой-то прямоугольник неверный',
      boardLabel: 'Поле: рисуй прямоугольники',
      undo: 'Отменить',
    },
    howto: {
      rule1: 'Раздели всё поле на <b>прямоугольники</b> (квадраты тоже подходят): <b>коснись клетки и тяни</b> — когда отпустишь, прямоугольник встанет точно по клеткам.',
      rule2: 'В каждом прямоугольнике <b>ровно одно число</b>, и оно показывает, <b>сколько клеток</b> в нём. Для <b>6</b> нужен 2×3, 3×2, 1×6 или 6×1.',
      rule3: '<b>Каждая клетка</b> принадлежит ровно одному прямоугольнику — в конце ничего не остаётся свободным.',
      rule4: '<b>Касание</b> прямоугольника удаляет его. Новый прямоугольник поверх старых их <b>заменяет</b>. Кнопка <b>Отменить</b> вверху отменяет твой последний ход.',
      rule5: 'Если поле <b>увеличено</b>, двигай его <b>двумя пальцами</b>.',
      rule6: 'У каждой головоломки одно решение, и оно находится <b>без угадывания</b>. Рисование никогда не считается ошибкой — жизнь теряется, только когда <b>все клетки покрыты</b>, а решение не сходится. Найти неверный прямоугольник — твоя задача.',
    },
    soloInvite: { shareText: 'Сыграй со мной в Rectangles! Присоединяйся к моей игре — код комнаты: {code}' },
    prestige: { master: { desc: 'Высший значок — открывается, когда ВСЕ 12 значков легендарные. Доказательство, что ты освоил Rectangles.' } },
  },
};
