import XLSX from 'xlsx';
import fs from 'fs';
const buf = fs.readFileSync('/tmp/user-uploads/BANCO_DE_DADOS_-_DOBRA.xlsm');
const wb = XLSX.read(buf, {type:'buffer', cellDates:true});
console.log(wb.SheetNames);
for (const name of ['BD-SCHED','BD-DADOS-DOBRA','BD-RELATORIO-PERFORMACE','BD-CONTROLE-RG']) {
  const ws = wb.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(ws, {defval:null, raw:false, rawNumbers:true});
  console.log('===', name, 'rows', rows.length);
  if (rows.length) {
    const r0 = rows[0];
    for (const k of Object.keys(r0)) {
      const v = r0[k];
      if (/data|dt|date/i.test(k)) console.log(' ', k, '=>', JSON.stringify(v), typeof v, v instanceof Date);
    }
  }
}
