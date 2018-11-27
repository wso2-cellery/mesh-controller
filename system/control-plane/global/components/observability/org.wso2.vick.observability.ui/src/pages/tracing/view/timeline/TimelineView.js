/*
 * Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/* eslint max-lines: ["off"] */

import "vis/dist/vis-timeline-graph2d.min.css";
import "./TimelineView.css";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import {ColorGenerator} from "../../../common/color/colorGenerator";
import Constants from "../../utils/constants";
import PropTypes from "prop-types";
import React from "react";
import ReactDOM from "react-dom";
import Span from "../../utils/span";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableRow from "@material-ui/core/TableRow";
import TracingUtils from "../../utils/tracingUtils";
import Typography from "@material-ui/core/Typography";
import interact from "interactjs";
import vis from "vis";
import {withStyles} from "@material-ui/core";
import {ColorGeneratorConstants, withColor} from "../../../common/color";

const styles = (theme) => ({
    spanLabelContainer: {
        width: 500,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        boxSizing: "border-box",
        display: "inline-block"
    },
    serviceName: {
        fontWeight: 500,
        fontSize: "normal"
    },
    operationName: {
        color: "#7c7c7c",
        fontSize: "small"
    },
    kindBadge: {
        borderRadius: "8px",
        color: "white",
        padding: "2px 5px",
        marginLeft: "15px",
        fontSize: "12px",
        display: "inline-block"
    },
    resizeHandle: {
        transform: "translateX(-5px)",
        backgroundColor: "#919191",
        cursor: "ew-resize",
        position: "absolute",
        width: "5px",
        height: "100%",
        userSelect: "none"
    },
    spanDescriptionContent: {
        margin: "5px 12px 5px 7px"
    },
    overallDescriptionContainer: {
        paddingTop: theme.spacing.unit * 3,
        paddingRight: 0,
        paddingBottom: theme.spacing.unit * 2,
        paddingLeft: 0
    },
    overallDescriptionKey: {
        fontWeight: 500,
        color: "#5a5a5a",
        paddingRight: "5px"
    },
    overallDescriptionValue: {
        color: "#7c7c7c"
    },
    overallDescriptionSeparator: {
        borderStyle: "solid",
        borderWidth: "0 0 0 1px",
        marginLeft: theme.spacing.unit * 2,
        marginRight: theme.spacing.unit * 2
    }
});

class TimelineView extends React.Component {

    constructor(props) {
        super(props);

        this.timelineNode = React.createRef();
        this.timeline = null;
        this.timelineEventListeners = [];
        this.spanLabelWidth = 400;

        this.trace = {
            tree: null,
            treeHeight: 0,
            spans: [],
            minTime: 0,
            maxTime: Number.MAX_VALUE
        };
    }

    componentDidMount() {
        this.drawTimeline();
    }

    componentDidUpdate() {
        this.drawTimeline();
    }

    componentWillUnmount() {
        const {classes} = this.props;

        // Removing interactions added to the timeline
        TimelineView.clearInteractions(`.${classes.resizeHandle}`);
        TimelineView.clearInteractions(`.${classes.spanLabelContainer}`);

        // Destroying the timeline
        if (this.timeline) {
            this.timeline.destroy();
        }
    }

    render() {
        const {classes} = this.props;
        this.calculateTrace();

        const serviceNames = [];
        for (let i = 0; i < this.trace.spans.length; i++) {
            const serviceName = this.trace.spans[i].serviceName;
            if (!serviceNames.includes(serviceName)) {
                serviceNames.push(serviceName);
            }
        }
        const duration = this.trace.maxTime - this.trace.minTime;
        const traceStart = new Date(this.trace.minTime).toGMTString();

        return (
            <React.Fragment>
                <div className={classes.overallDescriptionContainer}>
                    <span className={classes.overallDescriptionKey}>Trace Start:</span>
                    <span className={classes.overallDescriptionValue}>{traceStart}</span>
                    <span className={classes.overallDescriptionSeparator}/>
                    <span className={classes.overallDescriptionKey}>Duration:</span>
                    <span className={classes.overallDescriptionValue}>{duration}ms</span>
                    <span className={classes.overallDescriptionSeparator}/>
                    <span className={classes.overallDescriptionKey}>Services:</span>
                    <span className={classes.overallDescriptionValue}>{serviceNames.length}</span>
                    <span className={classes.overallDescriptionSeparator}/>
                    <span className={classes.overallDescriptionKey}>Depth:</span>
                    <span className={classes.overallDescriptionValue}>{this.trace.treeHeight}</span>
                    <span className={classes.overallDescriptionSeparator}/>
                    <span className={classes.overallDescriptionKey}>Total Spans:</span>
                    <span className={classes.overallDescriptionValue}>{this.trace.spans.length}</span>
                </div>
                <div ref={this.timelineNode}/>
            </React.Fragment>
        );
    }

    calculateTrace() {
        const {spans} = this.props;
        this.trace.tree = TracingUtils.buildTree(spans);
        this.trace.spans = TracingUtils.getOrderedList(this.trace.tree);

        // Finding the maximum tree height
        this.trace.treeHeight = 0;
        let minLimit = Number.MAX_VALUE;
        let maxLimit = 0;
        const cellNames = [];
        this.trace.tree.walk((span) => {
            if (span.treeDepth > this.trace.treeHeight) {
                this.trace.treeHeight = span.treeDepth;
            }
            if (span.startTime < minLimit) {
                minLimit = span.startTime;
            }
            if (span.startTime + span.duration > maxLimit) {
                maxLimit = span.startTime + span.duration;
            }
            if (span.cell.name && !cellNames.includes(span.cell.name)) {
                cellNames.push(span.cell.name);
            }
        });
        this.trace.treeHeight += 1;
        this.trace.minTime = minLimit;
        this.trace.maxTime = maxLimit;
    }

    drawTimeline() {
        const {classes, colorGenerator} = this.props;
        const self = this;

        // Un-selecting the spans
        this.selectedSpan = null;

        const kindsData = {
            CLIENT: {
                name: "Client",
                color: "#9c27b0"
            },
            SERVER: {
                name: "Server",
                color: "#4caf50"
            },
            PRODUCER: {
                name: "Producer",
                color: "#03a9f4"
            },
            CONSUMER: {
                name: "Consumer",
                color: "#009688"
            }
        };

        const duration = (this.trace.maxTime - this.trace.minTime);
        const minLimit = this.trace.minTime - duration * 0.05;
        const maxLimit = this.trace.maxTime + duration * 0.12;

        const options = {
            orientation: "top",
            showMajorLabels: true,
            editable: false,
            selectable: false,
            groupEditable: false,
            showCurrentTime: false,
            min: new Date(minLimit),
            max: new Date(maxLimit),
            start: new Date(minLimit),
            end: new Date(maxLimit),
            order: (itemA, itemB) => itemA.order - itemB.order,
            groupTemplate: (item) => {
                const newElement = document.createElement("div");
                if (item && item.span.serviceName) {
                    const kindData = kindsData[item.span.kind];
                    const isLeaf = item.span.children.size;
                    ReactDOM.render((
                        <div>
                            <div style={{
                                paddingLeft: `${(item.span.treeDepth + (isLeaf === 0 ? 1 : 0)) * 15}px`,
                                minWidth: `${(this.trace.treeHeight + 1) * 15 + 100}px`,
                                width: `${(self.spanLabelWidth > 0 ? self.spanLabelWidth : null)}px`
                            }} className={classes.spanLabelContainer}>
                                <span className={classes.serviceName}>{`${item.span.serviceName} `}</span>
                                <span className={classes.operationName}>{item.span.operationName}</span>
                            </div>
                            {(kindData
                                ? <div className={classes.kindBadge}
                                    style={{backgroundColor: kindData.color}}>{kindData.name}</div>
                                : null
                            )}
                        </div>
                    ), newElement);
                }
                return newElement;
            },
            template: (item, element) => {
                const newElement = document.createElement("div");
                let content = <span>{item.content}</span>;
                if (item.itemType === TimelineView.Constants.ItemType.SPAN) {
                    content = <span>{item.span.duration} ms</span>;

                    // Finding the proper color for this item
                    let colorKey = item.span.cell.name;
                    if (!colorKey) {
                        if (item.span.componentType === Constants.Span.ComponentType.VICK) {
                            colorKey = ColorGeneratorConstants.VICK;
                        } else if (item.span.componentType === Constants.Span.ComponentType.ISTIO) {
                            colorKey = ColorGeneratorConstants.ISTIO;
                        } else {
                            colorKey = item.span.componentType;
                        }
                    }
                    const color = colorGenerator.getColor(colorKey);

                    // Applying the color onto the item
                    const parent = element.parentElement.parentElement;
                    parent.style.backgroundColor = color;
                    parent.style.borderColor = color;
                } else if (item.itemType === TimelineView.Constants.ItemType.SPAN_DESCRIPTION) {
                    const rows = [];
                    for (const key in item.span.tags) {
                        if (item.span.tags.hasOwnProperty(key)) {
                            rows.push({
                                key: key,
                                value: item.span.tags[key]
                            });
                        }
                    }
                    if (rows.length > 0) {
                        content = (
                            <Card className={classes.spanDescriptionContent}>
                                <CardContent>
                                    <Typography color="textSecondary" gutterBottom>Tags</Typography>
                                    <Table>
                                        <TableBody>
                                            {
                                                rows.map((row, index) => (
                                                    <TableRow hover key={index}>
                                                        <TableCell component="th" scope="row">
                                                            <div>{row.key}</div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>{row.value}</div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            }
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        );
                    }
                }
                ReactDOM.render(content, newElement);
                element.setAttribute(TimelineView.Constants.SPAN_ID_ATTRIBUTE_KEY, item.span.getUniqueId());
                return newElement;
            }
        };

        /*
         * Due to the way the vis timeline inserts the items (insert children at each node) the order of the spans
         * drawn gets messed up. To avoid this the tree should be drawn from leaves to the root node. To achieve this
         * and make sure the tree is right-side up a dual reverse (reversing span array and reversing group order
         * function) is used.
         */
        options.groupOrder = (a, b) => b.order - a.order;
        const reversedSpans = this.trace.spans.slice().reverse();

        // Clear previous interactions (eg:- resizability) added to the timeline
        const selector = `.${classes.spanLabelContainer}`;
        TimelineView.clearInteractions(`.${classes.resizeHandle}`);
        TimelineView.clearInteractions(selector);

        // Creating / Updating the timeline
        if (!this.timeline) {
            this.timeline = new vis.Timeline(this.timelineNode.current);
            this.addTimelineEventListener("changed", () => {
                // Adjust span description
                const timelineWindowWidth = document.querySelector(".vis-foreground").offsetWidth;
                const fitDescriptionToTimelineWindow = (node) => {
                    node.style.left = "0px";
                    node.style.width = `${timelineWindowWidth}px`;
                };
                document.querySelectorAll("div.vis-item-span-description")
                    .forEach(fitDescriptionToTimelineWindow);
                document.querySelectorAll(".vis-item-content")
                    .forEach(fitDescriptionToTimelineWindow);

                // Adjust span duration labels
                document.querySelectorAll("div.vis-item-span").forEach((node) => {
                    node.querySelector("div.vis-item-overflow").style.transform
                        = `translateX(${node.offsetWidth + 7}px)`;
                });

                // Adjust item vertical location
                const spanItems = document.querySelectorAll("div.vis-item-span");
                const minHeight = Reflect.apply([].slice, spanItems, [])
                    .map((node) => node.parentElement.offsetHeight)
                    .reduce(
                        (accumulator, currentValue) => (currentValue < accumulator ? currentValue : accumulator),
                        Number.MAX_VALUE
                    );
                spanItems.forEach((node) => {
                    node.style.top = `${(minHeight - node.offsetHeight) / 2}px`;
                });
            });
        }
        this.clearTimelineEventListeners("click");
        this.addTimelineEventListener("click", (event) => {
            if (event.what === "item" || event.what === "background") {
                if (this.selectedSpan === event.group) {
                    this.selectedSpan = null;
                } else {
                    this.selectedSpan = event.group;
                }
                this.updateTimelineItems(reversedSpans, {min: minLimit, max: maxLimit});
            }
        });

        this.timeline.setOptions(options);
        this.updateTimelineItems(reversedSpans, {min: minLimit, max: maxLimit});

        // Add resizable functionality
        this.addHorizontalResizability(selector);
    }

    /**
     * Update the items in the timeline.
     *
     * @param {Array.<Span>} spans The spans which should be displayed in the timeline
     * @param {{min: number, max: number}} limits of the timeline
     */
    updateTimelineItems(spans, limits) {
        // Populating timeline items and groups
        const groups = [];
        const items = [];
        for (let i = 0; i < spans.length; i++) {
            const span = spans[i];

            // Fetching all the children and grand-chilren of this node
            const nestedGroups = [];
            span.walk((currentSpan) => {
                if (currentSpan !== span) {
                    nestedGroups.push(currentSpan.getUniqueId());
                }
            });

            // Adding span
            items.push({
                id: `${span.getUniqueId()}-span`,
                itemType: TimelineView.Constants.ItemType.SPAN,
                order: 1,
                start: new Date(span.startTime),
                end: new Date(span.startTime + span.duration),
                group: span.getUniqueId(),
                className: "vis-item-span",
                span: span
            });
            if (this.selectedSpan && this.selectedSpan === span.getUniqueId()) {
                items.push({
                    id: `${span.getUniqueId()}-span-description`,
                    itemType: TimelineView.Constants.ItemType.SPAN_DESCRIPTION,
                    order: 2,
                    start: new Date(limits.min),
                    end: new Date(limits.max),
                    group: span.getUniqueId(),
                    className: "vis-item-span-description",
                    span: span
                });
            }
            groups.push({
                id: span.getUniqueId(),
                order: i * 2,
                nestedGroups: nestedGroups.length > 0 ? nestedGroups : null,
                span: span
            });
        }

        this.timeline.setGroups(new vis.DataSet(groups));
        this.timeline.setItems(new vis.DataSet(items));
    }

    /**
     * Add resizability to a set of items in the timeline.
     *
     * @param {string} selector The CSS selector of the items to which the resizability should be added
     */
    addHorizontalResizability(selector) {
        const self = this;
        const edges = {right: true};
        const {classes} = this.props;

        // Add the horizontal resize handle
        const newNode = document.createElement("div");
        newNode.classList.add(classes.resizeHandle);
        const parent = document.querySelector(".vis-panel.vis-top");
        parent.insertBefore(newNode, parent.childNodes[0]);

        // Handling the resizing
        interact(selector).resizable({
            manualStart: true,
            edges: edges
        }).on("resizemove", (event) => {
            const targets = event.target;
            targets.forEach((target) => {
                // Update the element's style
                target.style.width = `${event.rect.width}px`;

                // Store the current width to be used when the timeline is redrawn
                self.spanLabelWidth = event.rect.width;

                // Trigger timeline redraw
                self.timeline.body.emitter.emit("_change");
            });
        });

        // Handling dragging of the resize handle
        interact(`.${classes.resizeHandle}`).on("down", (event) => {
            event.interaction.start(
                {
                    name: "resize",
                    edges: edges
                },
                interact(selector),
                document.querySelectorAll(selector)
            );
        });
    }

    addTimelineEventListener(name, callBack) {
        this.timeline.on(name, callBack);
        this.timelineEventListeners.push({
            name: name,
            callBack: callBack
        });
    }

    /**
     * Clear the event listeners that were added to the timeline.
     *
     * @param {string} name The name of the event for which the event listeners should be cleared (All cleared if null)
     */
    clearTimelineEventListeners(name) {
        let timelineEventListeners;
        if (name) {
            timelineEventListeners = this.timelineEventListeners
                .filter((eventListener) => eventListener.name === name);
            this.timelineEventListeners = this.timelineEventListeners
                .filter((eventListener) => eventListener.name !== name);
        } else {
            timelineEventListeners = this.timelineEventListeners;
            this.timelineEventListeners = [];
        }

        for (let i = 0; i < timelineEventListeners.length; i++) {
            const eventListener = timelineEventListeners[i];
            this.timeline.off(eventListener.name, eventListener.callBack);
        }
    }

    /**
     * Clear interactions added to the timeline.
     *
     * @param {string} selector The CSS selector of the items from which the interactions should be cleared
     */
    static clearInteractions(selector) {
        interact(selector).unset();
    }

}

TimelineView.propTypes = {
    classes: PropTypes.any.isRequired,
    spans: PropTypes.arrayOf(
        PropTypes.instanceOf(Span).isRequired
    ).isRequired,
    colorGenerator: PropTypes.instanceOf(ColorGenerator)
};

TimelineView.Constants = {
    SPAN_ID_ATTRIBUTE_KEY: "spanId",
    ItemType: {
        SPAN: "span",
        SPAN_DESCRIPTION: "description"
    }
};

export default withStyles(styles, {withTheme: true})(withColor(TimelineView));
