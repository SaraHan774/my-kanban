# Graph View Implementation Guide

## Overview

The Graph View visualizes the connections between pages in your workspace, showing:
- **Nodes**: Pages
- **Edges**: Wiki-style links between pages
- **Clusters**: Groups of related pages
- **Orphans**: Pages with no connections
- **Hubs**: Highly connected pages

## Installation

### Option A: React Flow (Recommended)

```bash
npm install reactflow
```

### Option B: D3.js Force Graph

```bash
npm install d3
```

### Option C: Cytoscape.js

```bash
npm install cytoscape react-cytoscapejs
```

## Implementation

### 1. Graph Service

Created: `src/services/graphService.ts`

**Features:**
- Build graph from pages
- Detect orphan pages (no links)
- Detect hub pages (many links)
- Find clusters (connected components)
- Calculate shortest path between pages
- Get neighbors, backlinks, forward links

### 2. React Flow Component

```typescript
// src/components/GraphView.tsx
import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '@/store/useStore';
import { graphService } from '@/services/graphService';
import { useNavigate } from 'react-router-dom';
import dagre from 'dagre'; // For automatic layout

export function GraphView() {
  const { pages } = useStore();
  const navigate = useNavigate();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Build graph from pages
  const graph = useMemo(() => graphService.buildGraph(pages), [pages]);

  // Auto-layout using Dagre
  const getLayoutedElements = (nodes: Node[], edges: Edge[]) => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'TB' }); // Top to Bottom

    nodes.forEach(node => {
      dagreGraph.setNode(node.id, { width: 150, height: 50 });
    });

    edges.forEach(edge => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map(node => {
      const nodeWithPosition = dagreGraph.node(node.id);
      return {
        ...node,
        position: {
          x: nodeWithPosition.x,
          y: nodeWithPosition.y,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  };

  // Convert graph nodes to React Flow nodes
  const initialNodes = useMemo(() => {
    return graph.nodes.map(node => ({
      id: node.id,
      data: {
        label: node.title,
        connections: node.connections,
        type: node.type,
      },
      position: { x: 0, y: 0 }, // Will be set by layout
      style: {
        background: node.type === 'hub' ? '#3b82f6' :
                   node.type === 'orphan' ? '#ef4444' : '#22c55e',
        color: 'white',
        border: selectedNode === node.id ? '3px solid gold' : 'none',
        padding: 10,
        borderRadius: 8,
        fontSize: 12,
        width: 150,
      },
    }));
  }, [graph, selectedNode]);

  // Convert graph edges to React Flow edges
  const initialEdges = useMemo(() => {
    return graph.edges.map(edge => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: edge.bidirectional,
      style: {
        stroke: edge.bidirectional ? '#3b82f6' : '#666',
        strokeWidth: edge.bidirectional ? 2 : 1,
      },
      markerEnd: {
        type: 'arrowclosed' as const,
      },
    }));
  }, [graph]);

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Handle node click
  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);

    // Show neighbors
    const neighbors = graphService.getNeighbors(graph, node.id);
    console.log('Neighbors:', neighbors);

    // Optional: Navigate to page
    // navigate(`/page/${node.id}`);
  }, [graph, navigate]);

  // Handle node double click - navigate to page
  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    navigate(`/page/${node.id}`);
  }, [navigate]);

  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <div className="graph-controls">
        <div className="graph-stats">
          <span>📄 {graph.nodes.length} pages</span>
          <span>🔗 {graph.edges.length} links</span>
          <span>🔴 {graph.orphans.length} orphans</span>
          <span>⭐ {graph.hubs.length} hubs</span>
          <span>📦 {graph.clusters.length} clusters</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            const type = node.data.type;
            if (type === 'hub') return '#3b82f6';
            if (type === 'orphan') return '#ef4444';
            return '#22c55e';
          }}
        />
      </ReactFlow>

      {selectedNode && (
        <div className="node-details">
          <h3>Selected Page</h3>
          <p>{nodes.find(n => n.id === selectedNode)?.data.label}</p>
          <p>Connections: {nodes.find(n => n.id === selectedNode)?.data.connections}</p>
          <button onClick={() => navigate(`/page/${selectedNode}`)}>
            Open Page
          </button>
        </div>
      )}
    </div>
  );
}
```

### 3. CSS Styling

```css
/* src/components/GraphView.css */
.graph-controls {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 10;
  background: white;
  padding: 1rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.graph-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
}

.graph-stats span {
  padding: 0.5rem;
  background: var(--bg-secondary);
  border-radius: 6px;
}

.node-details {
  position: absolute;
  bottom: 1rem;
  right: 1rem;
  z-index: 10;
  background: white;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  min-width: 200px;
}
```

## Features

### 1. Node Types

- 🟢 **Normal Page**: Regular page with connections
- 🔵 **Hub Page**: Highly connected (>5 links)
- 🔴 **Orphan Page**: No connections

### 2. Edge Types

- **Solid Arrow**: One-way link
- **Animated Double Arrow**: Bidirectional link (both pages link to each other)

### 3. Interactions

- **Click**: Select node, highlight neighbors
- **Double Click**: Navigate to page
- **Drag**: Move nodes around
- **Scroll**: Zoom in/out
- **Minimap**: Navigate large graphs

### 4. Layout Algorithms

#### Force-Directed (Physics-based)
```typescript
const layoutOptions = {
  name: 'cose',
  animate: true,
  nodeRepulsion: 4000,
  gravity: 0.25,
};
```

#### Hierarchical (Tree-like)
```typescript
const layoutOptions = {
  name: 'dagre',
  rankDir: 'TB', // Top to Bottom
  ranker: 'longest-path',
};
```

#### Circular
```typescript
const layoutOptions = {
  name: 'circle',
  radius: 500,
};
```

## Advanced Features

### 1. Filter by Tags

```typescript
const [filterTags, setFilterTags] = useState<string[]>([]);

const filteredNodes = nodes.filter(node => {
  const page = pages.find(p => p.id === node.id);
  return filterTags.length === 0 ||
         page?.tags.some(tag => filterTags.includes(tag));
});
```

### 2. Highlight Path

```typescript
const highlightPath = (fromId: string, toId: string) => {
  const path = graphService.getShortestPath(graph, fromId, toId);

  if (path) {
    // Highlight nodes in path
    setNodes(nodes.map(node => ({
      ...node,
      style: {
        ...node.style,
        border: path.includes(node.id) ? '3px solid gold' : 'none',
      },
    })));

    // Highlight edges in path
    const pathEdges = new Set();
    for (let i = 0; i < path.length - 1; i++) {
      pathEdges.add(`${path[i]}-${path[i+1]}`);
    }

    setEdges(edges.map(edge => ({
      ...edge,
      animated: pathEdges.has(edge.id),
      style: {
        ...edge.style,
        stroke: pathEdges.has(edge.id) ? 'gold' : '#666',
      },
    })));
  }
};
```

### 3. Search & Focus

```typescript
const focusNode = (nodeId: string) => {
  const node = nodes.find(n => n.id === nodeId);
  if (node) {
    setCenter(node.position.x, node.position.y, { zoom: 1.5, duration: 800 });
    setSelectedNode(nodeId);
  }
};
```

### 4. Export as Image

```typescript
import { toPng } from 'html-to-image';

const downloadImage = () => {
  const element = document.querySelector('.react-flow');
  if (element) {
    toPng(element as HTMLElement).then(dataUrl => {
      const link = document.createElement('a');
      link.download = 'graph.png';
      link.href = dataUrl;
      link.click();
    });
  }
};
```

## Integration

### Add Route

```typescript
// App.tsx
import { GraphView } from '@/components/GraphView';

<Route path="/graph" element={<GraphView />} />
```

### Add Navigation

```typescript
// Sidebar or Settings
<Link to="/graph">
  <span className="material-symbols-outlined">hub</span>
  Graph View
</Link>
```

## Performance Tips

1. **Lazy Loading**: Only load visible nodes
2. **Virtualization**: Use for large graphs (>1000 nodes)
3. **Clustering**: Group distant nodes
4. **Simplification**: Hide low-importance edges

## Example Use Cases

1. **Knowledge Base**: See how your notes are connected
2. **Project Planning**: Visualize dependencies
3. **Content Discovery**: Find related pages
4. **Dead End Detection**: Find orphan pages
5. **Hub Identification**: Find central topics

## Comparison

| Feature | React Flow | D3.js | Cytoscape |
|---------|-----------|-------|-----------|
| Ease of Use | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| React Integration | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Customization | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Built-in Features | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |

**Recommendation**: Start with **React Flow** for quick implementation and good defaults.
