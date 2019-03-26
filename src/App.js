import React, { Component } from 'react';
import { Upload, Select, Button, Switch, Icon, Menu, message, Skeleton, Alert } from 'antd';
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
    this.setState({
      [table]: {
        data: [],
        columns: [],
      }
    })
    parseCSV(e)
    .then(res=>{
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
    .catch(error=>this.setState({error}))
  }

  handleCalculate = (data) => {
    return new Promise( async (resolve,reject) =>{
      let sumBy = this.state.mainTable.columns.find(c => c.selectOption === 'sum-by')
      if (!sumBy) {
        this.setState({
          error: {
            type: 'error',
            header: 'No Sum-by selected',
            list: ['Please select a column to sum by'],
          }
        })
        return
      }
      // add extra sumBy column to table and set records in data to loading
      this.setState({
        mainTable: {
          ...this.state.mainTable,
          data: this.state.mainTable.data.map(r => ({ ...r, isLoading: true })),
          columns: [
            ...this.state.mainTable.columns,
            data.queryKey && { title: data.queryKey.name, dataIndex: data.queryKey.name, key: data.queryKey.name, selectOption: 'text' }
          ]
        }
      })
      if (data.apiKey) {
        // query geocode
        let newData = await this.queryGeocode(data.apiKey, data.queryKey, this.state.mainTable.data, sumBy.key)
        // sum the returned data by the queryKey
        this.sumData(newData, this.state.mainTable.columns, data.queryKey.name,'mainTable',)
      } else {
        this.sumData(this.state.mainTable.data, this.state.mainTable.columns, sumBy.title, 'mainTable')
      }
      resolve({ text: 'Success', status: 'success' })
    })
  }

  getGeocodeValue = (res, queryKey, sumBy) => {
    return res.results[0] ? res.results[0].address_components.find(ac=>ac.types.find(t=>t===queryKey)).long_name : `Not Found - ${sumBy}`
  }

  queryGeocode = async (apiKey, queryKey, data, sumBy) => {
    let foundData = []
    let errors = []
    for (let row of data) {
      let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${row[sumBy]}&sensor=true&key=${apiKey}`;
      await apiCall('get',url)
      .then(res=>{
        let geoVal = this.getGeocodeValue(res, queryKey.value, row[sumBy])
        foundData.push({ ...row, [queryKey.name]: geoVal})
        geoVal === `Not Found - ${row[sumBy]}` && errors.push(`API request for ${row[sumBy]} did not find any data`);
        this.setState({mainTable:{
          ...this.state.mainTable,
          data: this.state.mainTable.data.map(r=> row.key === r.key ? ({...r,isLoading: false}) : ({...r,}))
        }})
      })
      .catch(err=>{
        console.log(err)
        errors.push(`API request failed for ${row[sumBy]}`)
      })
    }
    if (errors.length > 0) this.setState({error: {list: errors, type: 'error', header: 'Geocode API Errors'}})
    return foundData
  }

  sumData = (data,columns,sumBy,table) => {
    let sumCols = columns.filter(col=>col.selectOption !== 'sum-by')
    data = data.reduce((accumulator, currentItem) => {
      // check if the currentItem sumBy key is already in our summed array
      const index = accumulator.findIndex((item) => (item[sumBy] === currentItem[sumBy]))
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
    }, [])
    this.setState({
      [table]: {
        ...this.state[table],
        data,
        columns,
      }
    })
  }

  convertColstoArr = (table) => {
    let { columns, data } = this.state[table]
    const sumBy = columns.find(col=>col.selectOption === 'sum-by')
    columns = columns.filter(col=>col.key !== sumBy.key)
    let newData = []
    let i = 0
    for (let row of data) {
      for (let col of columns) {
        newData.push({
          sku: `${row[sumBy.key]}-${col.key}`,
          quantity: row[col.key],
          key: `${i}&${col.key}`,
        });
      }
      i++
    }
    this.setState({
      [table]: {
        ...this.state[table],
        columns: Object.keys(newData[0]).filter(c=>c!=='key').map(col=>({title: col, key: col, dataIndex: col, selectOption: col === 'sku' ? 'sum-by' : 'number'})),
        data: newData,
      }
    })
  }

  render() {
    return (
      <div className="App">
        <h1>Geocode Calculator</h1>
        {this.state.error && (
          <Alert 
            closable
            afterClose={()=>this.setState({error: null})}
            message={this.state.error.header}
            description={(
              <ul id="err-list">
                {this.state.error.list.map((t,i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            )}
            type={this.state.error.type}
          />
        )}
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
              <Button
                size="large"
                type="primary"
                onClick={() => this.convertColstoArr('mainTable')}
              >
                Map Cols to Fields
                </Button>
              <Button
                onClick={() => exportJsontoCSV(this.state.mainTable.data)}
              >
                Export
              </Button>
              {this.state.mainTable && (
                <Button
                  size="large"
                  type="primary"
                  onClick={this.handleCalculate}
                >
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
            onSave={this.handleCalculate}
          />
        )}
        {this.state.mainTable && (
          <BasicTable
            {...this.state.mainTable}
            columns={this.state.mainTable.columns.map(c => ({
              ...c,
              render: (text, record, index) =>(
                <Skeleton paragraph={false} loading={record.isLoading}>
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