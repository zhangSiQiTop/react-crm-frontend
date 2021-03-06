'use strict';
var _ = require('lodash'); // XXX: expand to exact import
var React = require('react');
var Reflux = require('reflux');
var titleCase = require('title-case');

var reactabular = require('reactabular');
var Search = reactabular.Search;
var Table = reactabular.Table;

var Paginator = require('react-pagify');

var Form = require('lib/Form');
var Modal = require('./Modal');
var getVisible = require('./get_visible');


module.exports = React.createClass({
    displayName: 'Table',

    mixins: [Reflux.ListenerMixin],

    propTypes: {
        api: React.PropTypes.object,
        actions: React.PropTypes.object,
        columns: React.PropTypes.array,
        store: React.PropTypes.object,
        schema: React.PropTypes.object,
        onSort: React.PropTypes.func,
    },

    getInitialState() {
        const perPage = 10;
        const actions = this.props.actions;
        const store = this.props.store;
        const schema = this.props.schema || {};
        const visibleColumns = this.props.columns;

        if(store) {
            this.listenTo(this.props.store, this.onData);
        }

        if(actions) {
            actions.load({
                perPage: perPage,
            });
        }

        var columns = Object.keys(schema.properties).map(function(name) {
            return {
                property: name,
                header: titleCase(name),
            };
        });

        if(visibleColumns) {
            columns = columns.filter((o) => visibleColumns.indexOf(o.property) >= 0);
        }

        return {
            store: {
                data: [],
                count: 0,
            },
            modal: {
                title: null,
                content: null,
            },
            pagination: {
                page: 0,
                perPage: perPage,
            },
            search: {
                q: null,
                field: null,
            },
            sortBy: null,
            columns: columns,
        };
    },

    onData(store) {
        this.setState({
            store: store,
        });
    },

    render() {
        var columns = this.state.columns || [];
        var header = {
            onClick: (column) => {
                var actions = this.props.actions;
                var property = column.property;
                var pagination = this.state.pagination;
                var sortBy = this.state.sortBy;

                if(sortBy === property) {
                    sortBy = '-' + property;
                }
                else {
                    sortBy = property;
                }

                if(actions) {
                    this.props.actions.sort(_.merge({
                        sortBy: sortBy,
                    }, pagination));
                }

                this.setState({
                    sortBy: sortBy,
                });
            },
        };
        var store = this.state.store;
        var modal = this.state.modal;
        var pagination = this.state.pagination;
        var pageAmount = Math.ceil(store.count / pagination.perPage);
        var i18n = {
            noData: 'No data'
        };

        columns = columns.concat({
            cell: this.editCell,
        });

        return (
            store.data && store.data.length ?
            <div className='table-container'>
                <div className='table-controls'>
                    <div className='table-per-page-container'>
                        Per page <input type='text' defaultValue={pagination.perPage} onChange={this.onPerPage}></input>
                    </div>
                    <div className='table-search-container'>
                        Search <Search columns={columns} onChange={this.onSearch} />
                    </div>
                </div>
                <Table
                    className='pure-table pure-table-striped'
                    columns={columns}
                    data={store.data}
                    header={header} />
                {pageAmount > 1 ? <Paginator
                    page={pagination.page}
                    pages={pageAmount}
                    beginPages={3}
                    endPages={3}
                    onSelect={this.onSelectPage} /> : null}
                <Modal ref='modal' title={modal.title}>{modal.content}</Modal>
            </div>
            : <span>{i18n.noData}</span>
        );
    },

    onPerPage(e) {
        const actions = this.props.actions;
        const perPage = parseInt(e.target.value, 10);
        var pagination = this.state.pagination || {};

        pagination.perPage = perPage;

        this.setState({
            pagination: pagination
        });

        if(actions) {
            this.loadData();
        }
    },

    onSearch(d) {
        this.setState({
            search: {
                q: d.search.query,
                field: d.search.column,
            }
        }, this.loadData);
    },

    onSelectPage(page) {
        var pagination = this.state.pagination;

        pagination.page = page;

        this.props.actions.load(_.merge({
            sortBy: this.state.sortBy,
        }, pagination));

        this.setState({
            pagination: pagination,
        }, this.loadData);
    },

    loadData() {
        const actions = this.props.actions;

        if(!actions) {
            return;
        }

        const pagination = this.state.pagination || {};
        const search = this.state.search || {};

        this.props.actions.load(_.merge({
            sortBy: this.state.sortBy,
        }, pagination, search));
    },

    editCell(property, value, rowIndex) {
        var edit = () => {
            this.refs.modal.show();

            var onSubmit = (data, value, errors) => {
                this.refs.modal.hide();

                if(value === 'Cancel') {
                    return;
                }

                if(!Object.keys(errors).length) {
                    this.refs.modal.hide();

                    this.props.actions.update(data);
                }
            };

            var schema = this.props.schema || {};
            var data = this.props.store.data;
            var api = this.props.api;

            getVisible(api, schema.properties, (err, d) => {
                if(err) {
                    return console.error(err);
                }

                schema.properties = d;

                this.setState({
                    modal: {
                        title: 'Edit',
                        content: <Form
                            schema={schema}
                            values={data[rowIndex]}
                            onSubmit={onSubmit}
                        />
                    }
                });

                this.refs.modal.show();
            });
        };

        return {
            value: <span>
                <span className='edit' onClick={edit.bind(this)} style={{cursor: 'pointer'}}>
                    &#8665;
                </span>
            </span>
        };
    },
});
