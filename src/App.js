import React, { Component } from "react";
import {
  Upload,
  Select,
  Button,
  Skeleton,
  Alert
} from "antd";
import { parseCSV, exportJsontoCSV } from "./services/csv";
import { apiCall } from "./services/api";
import { refArr } from "./data";
import BasicTable from "./components/BasicTable";
import BasicForm from "./components/BasicForm";

const Dragger = Upload.Dragger;
const Option = Select.Option;

class App extends Component {
  constructor(props) {
    super(props)
    this.state = {

    }
  }

  toggle = key => {
    this.setState({ [key]: !this.state[key] });
  };

  handleSelect = option => {
    const { value, column, table } = option;
    this.setState({
      [table]: {
        ...this.state[table],
        columns: this.state[table].columns.map(c =>
          c.key === column.key ? { ...c, selectOption: value } : { ...c }
        )
      }
    });
  };

  generateTableData = data => {
    if (!Array.isArray(data) || typeof data[0] !== 'object') {
      this.setState({
        error: {
          list: ['Unable to generate table data']
        }
      })
      return {
        columns: [],
        rows: [],
      }
    }
    const columns = Object.keys(data[0]).map((c, i) => {
      const defaultValue =
        i === 0 || c === "id"
          ? "sum-by"
          : isNaN(data[0][c])
          ? "text"
          : "number";
      return {
        title: c,
        dataIndex: c,
        key: c,
        selectOption: defaultValue
      };
    });
    data = data.map((r, i) => ({ ...r, key: i }));
    return {
      columns,
      data
    };
  };

  handleFileUpload = async (e, table) => {
    this.setState({
      [table]: {
        data: [],
        columns: []
      }
    });
    parseCSV(e)
      .then(res => {
        const { columns, data } = this.generateTableData(res.json);
        this.setState({
          [table]: {
            columns,
            data
          }
        });
      })
      .catch(error => this.setState({ error }));
  };

  handleCalculate = async () => {
    const sumBy = this.getSumBy("mainTable");
    if (!sumBy) {
      return;
    }
    //set rocords to loading
    this.setState({
      mainTable: {
        ...this.state.mainTable,
        data: this.state.mainTable.data.map(r => ({ ...r, isLoading: true }))
      }
    });
    //get summed data
    let data = await this.sumData(
      this.state.mainTable.data,
      this.state.mainTable.columns,
      sumBy.title
    );
    this.setState({
      mainTable: {
        ...this.state.mainTable,
        data: data.map(r => ({ ...r, isLoading: false })),
        error: {
          header: `Success`,
          list: [
            `Succesfully Updated ${data.length} record${
              data.length > 1 ? "s." : "."
            }`
          ],
          status: "success"
        }
      }
    });
  };

  getGeocodeValue = (res, queryKey, sumBy) => {
    return res.results[0]
      ? res.results[0].address_components.find(ac =>
          ac.types.find(t => t === queryKey)
        ).long_name
      : `Not Found - ${sumBy}`;
  };

  getSumBy = table => {
    const sumBy = this.state[table].columns.find(
      c => c.selectOption === "sum-by"
    );
    if (!sumBy) {
      this.setState({
        error: {
          type: "error",
          header: "No Sum-by selected",
          list: ["Please select a column to sum by"]
        }
      });
    }
    return sumBy;
  };

  queryGeocode = data => {
    return new Promise(async (resolve, reject) => {
      let { apiKey, queryKey, queryString } = data;
      // add extra query for column to table and set records in data to loading
      this.setState({
        mainTable: {
          ...this.state.mainTable,
          data: this.state.mainTable.data.map(r => ({ ...r, isLoading: true })),
          columns: [
            ...this.state.mainTable.columns,
            data.queryKey && {
              title: data.queryKey.name,
              dataIndex: data.queryKey.name,
              key: data.queryKey.name,
              selectOption: "text"
            }
          ]
        }
      });
      let foundData = [];
      let errors = [];
      // loop data and add geocode value to foundData
      for (let row of this.state.mainTable.data) {
        let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${
          row[queryString.value]
        }&sensor=true&key=${apiKey}`;
        await apiCall("get", url)
          .then(res => {
            let geoVal = this.getGeocodeValue(
              res,
              queryKey.value,
              row[queryString.value]
            );
            row = {
              ...row,
              [queryKey.name]: geoVal,
              isLoading: false
            };
            foundData.push(row);
            geoVal === `Not Found - ${row[queryString.value]}` &&
              errors.push(
                `API request for ${
                  row[queryString.value]
                } did not find any data`
              );
          })
          .catch(err => {
            console.log(err);
            errors.push(`API request failed for ${row[queryString.value]}`);
          });
      }
      // update state with any errors and foundData
      if (errors.length > 0)
        this.setState({
          error: { list: errors, type: "error", header: "Geocode API Errors" }
        });
      this.setState({
        mainTable: {
          ...this.state.mainTable,
          data: foundData
        }
      });
      resolve({
        text: `Succesfully Updated ${foundData.length} record${
          foundData.length > 1 ? "s." : "."
        }`,
        status: "success"
      });
    });
  };

  sumData = (data, columns, sumBy) => {
    if (!data || !columns || !sumBy) {
      this.setState({
        error: {list: ['Unable to sum data!']}
      })
      return []
    }
    let sumCols = columns.filter(col => col.selectOption !== "sum-by");
    return data.reduce((accumulator, currentItem) => {
      // check if the currentItem sumBy key is already in our summed array
      const index = accumulator.findIndex(
        item => item[sumBy] === currentItem[sumBy]
      );
      if (index < 0) {
        // add the currentItem to the summed array
        accumulator.push(currentItem);
      } else {
        // loop the columns to sum, sum the number fields, space seperate the text fields
        for (let col of sumCols) {
          accumulator[index][col.key] =
            col.selectOption === "number"
              ? Number(accumulator[index][col.key])
              : accumulator[index][col.key];
          accumulator[index][col.key] +=
            col.selectOption === "number"
              ? Number(currentItem[col.key])
              : ` ${currentItem[col.key]}`;
        }
      }
      return accumulator;
    }, []);
  };

  convertColstoArr = formValues => {
    return new Promise((resolve, reject) => {
      const sumBy = this.getSumBy("mainTable");
      if (!sumBy) {
        reject({ text: "No Sum by", status: "error" });
      }
      let { columns, data } = this.state.mainTable;
      columns = columns.filter(col => col.key !== sumBy.key);
      let newData = [];
      let i = 0;
      for (let row of data) {
        for (let col of columns) {
          newData.push({
            [formValues.mapRef]: `${row[sumBy.key]}${formValues.seperator}${
              col.key
            }`,
            [formValues.mapVal]: row[col.key],
            key: `${i}&${col.key}`
          });
        }
        i++;
      }
      this.setState({
        mainTable: {
          ...this.state.mainTable,
          columns: Object.keys(newData[0])
            .filter(c => c !== "key")
            .map(col => ({
              title: col,
              key: col,
              dataIndex: col,
              selectOption: col === "sku" ? "sum-by" : "number"
            })),
          data: newData
        }
      });
      resolve({
        text: `Succesfully mapped ${newData.length} new value${
          newData.length > 1 ? "s." : "."
        }`,
        status: "success"
      });
    });
  };

  handleFunctionSelect = selected => {
    this.setState({
      selected
    });
  };

  handleLocationsLink = async () => {
        try {
        this.setState({
          buttonLoading: true,
          mainTable: {
            data: [1,2,3,4,5].map(n => ({
              prop: n,
              key: n,
              isLoading: true
            })),
            columns: [1, 2].map(n => ({
              title: "",
              dataIndex: "prop",
              key: n
            }))
          }
        });
        let res = await apiCall(
          "get",
          "https://spreadsheets.google.com/feeds/list/1ymfw7Ga6rjgWM_HzK0reGlz81pFs-M_94fFL3n4JZxQ/4/public/full?alt=json"
        );
        let results = [];
        let lastSku = {};
        let resArr = res.feed.entry.filter(e=>e.gsx$id && e.gsx$location && e.gsx$id.$t.length > 0)
        for (let entry of resArr) {
          if (!entry.gsx$location || !entry.gsx$id.$t) {
            continue;
          }
          let Location = entry.gsx$location.$t;
          let skuArr = entry.gsx$id.$t.split(",");
          for (let sku of skuArr) {
            sku = sku.startsWith(" ") ? sku.substring(1) : sku
            if (!sku) {
              continue
            } else {
              let [parent, model, size] = sku.split("-")
              if (model && model.includes("/") || model && model.length > 1 && model.endsWith("M") || parent && model && size && parent !== 'RH1909') {
                // full sku push result
                results.push({
                  sku,
                  Location,
                  parent
                })
                lastSku = {parent,model,size,Location}
              } else {
                //lookup
                lastSku = lastSku.Location !== Location ? {} : lastSku
                let needle = sku.length === 1 ? lastSku.parent+"-"+sku : sku.startsWith(".") ? lastSku.parent+"-"+lastSku.model+"-"+sku.substring(1) : sku
                if (needle.length <= 3 || !/^[rh,am]{2}/.test(needle.toLowerCase())) {
                  //bad needle (bad input on google sheet)
                  results = [{sku: needle, Location, status: 'error'}, ...results]
                  continue
                }
                let matches = refArr.filter(
                  r => r.sku.includes(needle) && !r.sku.includes("-FBA")
                );
                for (let match of matches) {
                  let [parent, model, size] = match.sku.split("-")
                  results.push({ sku: match.sku, Location, parent });                  
                  lastSku = {parent,model,size,Location};
                }
                if (Location == "G10") {
                  console.log({
                    needle,
                    matches,
                    parent,
                    model,
                    size,
                    lastSku
                  })
                }
              }
            }
          }
        }

        let { columns, data } = this.generateTableData(results);
        data = this.sumData(data,columns,'sku')

        this.setState({
          buttonLoading: false,
          mainTable: {
            data,
            columns
          }
        });

    } catch (err) {
      console.log({ err });
      this.setState({
        buttonLoading: false,
        error: { list: [err.toString()] }
      });
    }
  }

  handleTeapplixProductUpdate = ({apiKey,lookupKey}) => {
    return new Promise( async (resolve,reject) => {
      this.setState({
          teapplixLoading: true,
        })
        let Products = []
        for (let row of this.state.mainTable.data) {
          let {isLoading, key, parent, ...Product} = row
          Products.push({
            itemName: row[lookupKey.value],
            Product,
          })
        }
        Products.forEach(r=>delete r.Product[lookupKey.value])
        console.log({Products})
        await apiCall('put','https://cors-anywhere.herokuapp.com/https://api.teapplix.com/api2/Product',{Products},{headers: {"APIToken": apiKey, "content-type":"application/json","accept":"application/json"}})
        .then(res => {
          console.log({res})
          resolve({
            text: `Updated ${res.Products.length} item ${res.Products.length > 1 ? 's.' : '.'}`,
            status: 'success',
          })
        })
        .catch(err=>{
          console.log({err})
          reject({
            text: err.toString(),
            status: 'error',
          })
        })      
    })
  }

  render() {
    return (
      <div className="App">
        <h1>Geocode Calculator</h1>
        {this.state.error && (
          <Alert
            closable
            afterClose={() => this.setState({ error: null })}
            message={this.state.error.header}
            description={
              <ul id="err-list">
                {this.state.error.list.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            }
            type={this.state.error.type}
          />
        )}
        <div>
          <label
            htmlFor="upload"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: 10
            }}
          >
            <div
              className="ant-upload ant-upload-drag"
              style={{ maxWidth: 250, padding: 10 }}
            >
              <input
                hidden
                accept=".csv"
                id="upload"
                type="file"
                onChange={event => {
                  this.handleFileUpload(event, "mainTable");
                }}
                onClick={event => {
                  event.target.value = null;
                }}
              />
              <h3>Import CSV</h3>
            </div>
          </label>
          <Button
            loading={this.state.buttonLoading}
            size="large"
            type="primary"
            onClick={this.handleLocationsLink}
          >
            Link Locations
          </Button>
          {this.state.mainTable && (
            <div>
              <div style={{ margin: "0 auto", width: 250, marginBottom: 12 }}>
                <Select
                  placeholder="Choose Function"
                  style={{ width: "100%" }}
                  onChange={this.handleFunctionSelect}
                >
                  <Option value="sum">Sum Number Fields</Option>
                  <Option value="geocode">Query Google Geocode</Option>
                  <Option value="map">Map Headers to Fields</Option>
                  <Option value="teapplix">Update Products on Teapplix</Option>
                  <Option value="export">Export Table</Option>
                </Select>
              </div>
            </div>
          )}
        </div>
        <div style={{ maxWidth: 250 }}>
          {this.state.selected === "teapplix" && (
            <BasicForm
              inputs={[
                {
                  span: 24,
                  id: "lookupKey",
                  text: "SKU on Teapplix",
                  required: true,
                  type: "select",
                  selectOptions: this.state.mainTable.columns.map(c => ({
                    id: c.key,
                    name: c.title
                  })),
                  searchKey: "name"
                },
                { span: 24, id: "apiKey", text: "API Key" }
              ]}
              onSave={this.handleTeapplixProductUpdate}
              submitText={"Send Update"}
            />
          )}
          {this.state.selected === "export" && (
            <Button onClick={() => exportJsontoCSV(this.state.mainTable.data)}>
              Export
            </Button>
          )}
          {this.state.selected === "sum" && (
            <Button size="large" type="primary" onClick={this.handleCalculate}>
              Sum Number Fields
            </Button>
          )}
          {this.state.selected === "map" && (
            <BasicForm
              inputs={[
                {
                  span: 24,
                  id: "mapRef",
                  text: "Column for Mapped Headers",
                  required: true
                },
                {
                  span: 24,
                  id: "mapVal",
                  text: "Column for Mapped Values",
                  required: true
                },
                { span: 24, id: "seperator", text: "Seperator" }
              ]}
              onSave={this.convertColstoArr}
              submitText={"Map Headers to Fields"}
            />
          )}
          {this.state.selected === "geocode" && (
            <BasicForm
              inputs={[
                { span: 24, id: "apiKey", text: "API Key", required: true },
                {
                  span: 24,
                  id: "queryString",
                  text: "Query String",
                  required: true,
                  type: "select",
                  selectOptions: this.state.mainTable.columns.map(c => ({
                    id: c.key,
                    name: c.title
                  })),
                  searchKey: "name"
                },
                {
                  span: 24,
                  id: "queryKey",
                  text: "Query For",
                  required: true,
                  type: "select",
                  selectOptions: [
                    {
                      id: "locality",
                      name: "City"
                    },
                    {
                      id: "administrative_area_level_2",
                      name: "County"
                    },
                    {
                      id: "administrative_area_level_1",
                      name: "State"
                    },
                    {
                      id: "country",
                      name: "Country"
                    },
                    {
                      id: "postal_code",
                      name: "Postal Code"
                    }
                  ],
                  searchKey: "name"
                }
              ]}
              onSave={this.queryGeocode}
              submitText={"Run Query"}
            />
          )}
        </div>
        {this.state.mainTable && (
          <BasicTable
            {...this.state.mainTable}
            columns={this.state.mainTable.columns.map(c => ({
              ...c,
              render: (text, record, index) => (
                <Skeleton paragraph={false} active loading={record.isLoading}>
                  <span>{text}</span>
                </Skeleton>
              ),
              title: () => (
                <span>
                  <h4>{c.title}</h4>
                  <Select
                    style={{ width: 120 }}
                    placeholder="Field Type"
                    defaultValue={c.selectOption}
                    onChange={value =>
                      this.handleSelect({
                        value,
                        column: c,
                        table: "mainTable"
                      })
                    }
                  >
                    <Option
                      value="sum-by"
                      disabled={
                        this.state.mainTable.columns.find(
                          col => col.selectOption === "sum-by"
                        )
                          ? true
                          : false
                      }
                    >
                      Sum By
                    </Option>
                    <Option value="number">Number</Option>
                    <Option value="text">Text</Option>
                  </Select>
                </span>
              )
            }))}
          />
        )}
      </div>
    );
  }
}

export default App;
