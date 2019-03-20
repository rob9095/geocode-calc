import React, { Component } from 'react';
import { Upload, Select, Button, Switch, Icon, Menu, message } from 'antd';
import { parseCSV } from './services/csv';
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

  queryGeocode = (apiKey, queryKey, data, sumBy) => {
    let foundData = []
    for (let row of data) {
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${row[sumBy]}&sensor=true&key=${apiKey}`;
      apiCall('get',url)
      .then(res=>{
        foundData.push({ ...row, foundValue: this.getGeocodeValue(res, queryKey)})
      })
      .catch(err=>{
        console.log(err)
      })
    }
    this.sumData(foundData,this.state.mainTable.columns,'foundValue')
  }

  sumData = (data,columns,sumBy) => {
    let sumData = []
    for (let row of data) {
      let foundRow = sumData.find(r => r[sumBy] === row[sumBy])
      if (foundRow) {
        // add current rows number values to exisiting number values in existing row
        for (let col of columns) {
          foundRow[col.key] = foundRow[col.key] + row[col.key]
        }
        sumData = sumData.map(r=> r[sumBy] === row[sumBy] ? foundRow : r)
      } else {
        // create first row in sum table
        sumData.push(row)
      }
    }
    console.log(sumData)
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