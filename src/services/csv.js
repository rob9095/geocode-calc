const csvtojson = require("csvtojson");
const jsonexport = require("jsonexport/dist");

export const parseCSV = (event) => {
  return new Promise((resolve, reject) => {
    // Check for File API support.
    if (!window.FileReader) {
      reject({
        type: 'error',
        header: 'Please use a different browser',
        list: ['File reader not supported in browser'],
      });
    }
    if (!event.target.files[0].name.endsWith('.csv')) {
      reject({
        type: 'error',
        header: 'Invalid File Format',
        list: ['The imported file is not a .csv'],
      });
    }
    const reader = new FileReader();
    reader.readAsText(event.target.files[0]);
    reader.onload = async (e) => {
      let raw = await csvtojson().fromString(e.target.result)
      console.log(raw)
      let json = raw.map((l) => (Object.keys(l).reduce((c, k) => (c[k.toLowerCase()] = typeof l[k] === 'object' ? l[k][""] : l[k], c), {})))
      let jsonLowerCase = await csvtojson().fromString(e.target.result.toLowerCase())
      resolve({ json, jsonLowerCase })
    }
    reader.onerror = (err) => {
      console.log(err)
      reject({
        type: "error",
        header: "Unable to Read File",
        list: ["The imported file was unreadable, please check the file and try again"],
      });
    }
  })
}

export const exportJsontoCSV = (json, fileName) => {
  return new Promise((resolve,reject)=>{
    jsonexport(json, (err, csv)=>{
      if (err) return reject(err);
      fileName = fileName ? fileName + ".csv" : "export.csv"
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, fileName);
      } else {
        var link = document.createElement("a");
        if (link.download !== undefined) { // feature detection
          // Browsers that support HTML5 download attribute
          var url = URL.createObjectURL(blob);
          link.setAttribute("href", url);
          link.setAttribute("download", fileName);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
      resolve(csv);
    });
  })
}