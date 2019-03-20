const csvtojson = require("csvtojson");

export const parseCSV = (event) => {
  return new Promise((resolve, reject) => {
    // Check for File API support.
    if (!window.FileReader) {
      reject({
        errorType: 'error',
        errorHeader: 'Please use a different browser',
        errorList: ['File reader not supported in browser'],
      });
    }
    if (!event.target.files[0].name.endsWith('.csv')) {
      reject({
        errorType: 'error',
        errorHeader: 'Invalid File Format',
        errorList: ['The imported file is not a .csv'],
      });
    }
    const reader = new FileReader();
    reader.readAsText(event.target.files[0]);
    reader.onload = async (e) => {
      let raw = await csvtojson().fromString(e.target.result)
      let json = raw.map((l) => (Object.keys(l).reduce((c, k) => (c[k.toLowerCase()] = l[k], c), {})))
      let jsonLowerCase = await csvtojson().fromString(e.target.result.toLowerCase())
      resolve({ json, jsonLowerCase })
    }
    reader.onerror = (err) => {
      reject(err)
    }
  })
}
