//ソース：https://qiita.com/t-yama-3/items/9819600cec53723472d3

//定数の設定
const suuji1 = new Set("一二三四五六七八九十百千１２３４５６７８９123456789"); // 数字と判定する文字集合
const suuji2 = new Set("〇万億兆０0,"); // 直前の文字が数字の場合に数字と判定する文字集合
const kans = "〇一二三四五六七八九";
const nums = "０１２３４５６７８９";
const tais1 = "千百十"; // 大数1
const tais2 = "兆億万"; // 大数2

// ●関数(1) '五六七八'または'５６７８'(全角)を'5678'(半角)に単純変換する関数
export function Kan2Num(str) {
  let tmp; // 定数kansまたはnumsを1文字ずつ格納する変数
  for (let i = 0; i < kans.length; i++) {
    tmp = new RegExp(kans[i], "g"); // RegExpオブジェクトを使用（該当文字を全て変換するため）
    str = str.replace(tmp, i); // replaceメソッドで変換
  }
  for (let i = 0; i < nums.length; i++) {
    tmp = new RegExp(nums[i], "g"); // RegExpオブジェクトを使用（該当文字を全て変換するため）
    str = str.replace(tmp, i); // replaceメソッドで変換
  }
  return str;
}

// ●関数(2) '九億八千七百六十五万四千三百'を'987654300'に変換する関数（n=1: ４桁まで計算、n=4: 16桁まで計算）
export function Kan2NumCnv(str, n) {
  // 変数の宣言（[let ans = poss = 0, pos, block, tais, tmpstr;]とまとめても良い）
  let ans = 0; // 計算結果を格納する変数（数値型）
  let poss = 0; // 引数strにおける処理開始位置（数値型）
  let pos; // 引数strにおける大数（'十','百','千','万'など）の検索結果位置（数値型）
  let block; // 各桁の数値を格納する変数（数値型）
  let tais; // 大数を格納（文字列型）
  let tmpstr; // 引数strの処理対象部分を一時格納する変数（文字列型）

  if (n === 1) {
    // n == 1 の場合は４桁まで計算
    tais = tais1;
  } else {
    // n == 4 (n != 1) の場合は16桁まで計算（16桁では誤差が生じる）
    n = 4;
    tais = tais2;
  }

  for (let i = 0; i < tais.length; i++) {
    pos = str.indexOf(tais[i]); // indexOf関数は文字の検索位置を返す
    if (pos === -1) {
      // 検索した大数が存在しない場合
      continue; // 何もしないで次のループに
    } else if (pos === poss) {
      // 検索した大数が数字を持たない場合（'千'など）
      block = 1; // '千'は'一千'なので'1'を入れておく
    } else {
      // 検索した大数が数字を持つ場合（'五千'など）
      tmpstr = str.slice(poss, pos); // sliceメソッドは文字列の指定範囲を抽出する
      if (n === 1) {
        block = Number(Kan2Num(tmpstr)); // 1桁の数字を単純変換（上で作成したKan2Num関数を使用）
      } else {
        block = Kan2NumCnv(tmpstr, 1); // 4桁の数字を変換（本関数を再帰的に使用）
      }
    }
    ans += block * 10 ** (n * (tais.length - i)); // ans に演算結果を加算
    poss = pos + 1; // 処理開始位置を次の文字に移す
  }

  // 最後の桁は別途計算して加算
  if (poss !== str.length) {
    tmpstr = str.slice(poss, str.length);
    if (n === 1) {
      ans += Number(Kan2Num(tmpstr));
    } else {
      ans += Kan2NumCnv(tmpstr, 1);
    }
  }
  return ans;
}

// ●関数(3) '平成三十一年十二月三十日'を'平成31年12月30日'に変換
export function TextKan2Num(text) {
  let ans = ""; // 変換結果を格納する変数（文字列型）
  let tmpstr = ""; // 文字列中の数字部分を一時格納する変数（文字列型）
  for (let i = 0; i < text.length + 1; i++) {
    // 次のif文で文字が数字であるかを識別（Setオブジェクトのhasメソッドで判定）
    if (
      i !== text.length &&
      (suuji1.has(text[i]) || (tmpstr !== "" && suuji2.has(text[i])))
    ) {
      tmpstr += text[i]; // 数字が続く限りtmpstrに格納
    } else {
      // 文字が数字でない場合
      if (tmpstr !== "") {
        // tmpstrに数字が格納されている場合
        ans += Kan2NumCnv(tmpstr, 4); // 上で作成したKan2NumCnv関数で数字に変換してansに結合
        tmpstr = ""; // tmpstrを初期化
      }
      if (i !== text.length) {
        // 最後のループでない場合
        ans += text[i]; // 数字でない文字はそのまま結合
      }
    }
  }
  return ans;
}
