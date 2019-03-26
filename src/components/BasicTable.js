import React, { Component } from 'react';
import { Table } from 'antd';

class BasicTable extends Component {
  state = {
  }

  render() {
    return (
      <div className="basic-table" style={{width: '100%'}}>
        <Table dataSource={this.props.data} columns={this.props.columns} />
      </div>
    );
  }
}

export default BasicTable;