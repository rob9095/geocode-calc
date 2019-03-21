import React, { Component } from 'react';
import { Upload, Select, Button, Switch, Icon, Menu, message } from 'antd';
import { parseCSV, exportJsontoCSV } from './services/csv';
import { apiCall } from "./services/api";
import BasicTable from './components/BasicTable';
import BasicForm from './components/BasicForm';

const Dragger = Upload.Dragger;
const Option = Select.Option;

class App extends Component {
  state = {
  }

  toggle = (key) => {
    this.setState({[key]: !this.state[key]})
  }

  handleSelect = (option) => {
    const { value, column, table } = option
    this.setState({
      [table]: {
        ...this.state[table],
        columns: this.state[table].columns.map(c=>(
          c.key === column.key ? { ...c, selectOption: value } : { ...c }
        ))
      }
    })
  }

  handleFileUpload = async (e,table) => {
    parseCSV(e)
    .then(res=>{
      console.log(res)
      const columns = Object.keys(res.json[0]).map((c, i) => {
        const defaultValue = i === 0 || c === 'id' ? "sum-by" : isNaN(res.json[0][c]) ? 'text' : 'number';
        return {
          title: c,
          dataIndex: c,
          key: c,
          selectOption: defaultValue,
        };
      });
      const data = res.json.map((r,i)=>({...r, key: i}));
      this.setState({
        [table]: {
          columns,
          data,
        }
      })
    })
    .catch(err=>{
      console.log(err)
    })
  }

  handleCalculate = (data) => {
    return new Promise((resolve,reject) =>{
      let sumBy = this.state.mainTable.columns.find(c => c.selectOption === 'sum-by')
      if (!sumBy) {
        console.log('error no sum by')
        return
      }
      if (data.apiKey) {
        console.log('calculate and query geocode')
        console.log(data)
        this.queryGeocode(data.apiKey, data.queryKey, this.state.mainTable.data, sumBy.key)
      } else {
        console.log('calculate without geocode')
      }
      resolve({ text: 'Success', status: 'success' })
    })
  }

  getGeocodeValue = (res, queryKey) => {
    return res.results[0].address_components.find(ac=>ac.types.find(t=>t===queryKey)).long_name
  }

  queryGeocode = async (apiKey, queryKey, data, sumBy) => {
    let foundData = []
    for (let row of data) {
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${row[sumBy]}&sensor=true&key=${apiKey}`;
      await apiCall('get',url)
      .then(res=>{
        foundData.push({ ...row, [queryKey.name]: this.getGeocodeValue(res, queryKey.value)})
      })
      .catch(err=>{
        console.log(err)
      })
    }
    let summedData = this.sumData(foundData, this.state.mainTable.columns,queryKey.name)
    console.log(summedData)
    this.setState({
      mainTable: {
        ...this.state.mainTable,
        data: summedData,
        columns: [...this.state.mainTable.columns, {title: queryKey.name, dataIndex: queryKey.name, key: queryKey.name, selectOption: 'text'}]
      }
    })
  }

  sumData = (data,columns,sumBy) => {
    columns = columns.filter(col=>col.selectOption !== 'sum-by')
    return data.reduce((accumulator, currentItem) => {
      // check if the currentItem sumBy key is already in our summed array
      const index = accumulator.findIndex((item) => (item[sumBy] === currentItem[sumBy]))
      if (index < 0) {
        // add the currentItem to the summed array
        accumulator.push(currentItem);
      } else {
        // loop the columns, sum the number fields, space seperate the text fields
        for (let col of columns) {
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
    }, [])
  }

  render() {
    return (
      <div className="App">
        <h1>Geocode Calculator</h1>
        <div>
          <label htmlFor="upload">
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
          {this.state.mainTable && (
            <div style={{ display: "flex", padding: 10 }}>
              <div style={{ padding: 10 }}>
                <Switch
                  checked={this.state.queryGeocode}
                  onChange={() => this.toggle("queryGeocode")}
                />
              </div>
              {!this.state.queryGeocode && (
                <Button size="large" type="primary" onClick={this.handleCalculate}>
                  Calculate
                </Button>
              )}
              <Button onClick={() => exportJsontoCSV(this.state.mainTable.data)}>
                Export
              </Button>
            </div>
          )}
        </div>
        {this.state.queryGeocode === true && (
          <BasicForm
            inputs={[
              { span: 24, id: "apiKey", text: "API Key", required: true },
              {
                span: 24,
                id: "queryKey",
                text: "Query By",
                required: true,
                type: 'select',
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
            onSave={this.handleCalculate}
          />
        )}
        {this.state.mainTable && (
          <BasicTable
            {...this.state.mainTable}
            columns={this.state.mainTable.columns.map(c => ({
              ...c,
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