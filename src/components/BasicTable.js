import React, { Component } from 'react';
import { Table } from 'antd';

class BasicTable extends Component {
  state = {
  }

  render() {
    return (
      <div className="basic-table">
        <Table dataSource={this.props.data} columns={this.props.columns} />
      </div>
    );
  }
}

export default BasicTable;