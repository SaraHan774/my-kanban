/**
 * Graph Service
 * Builds a graph representation of page connections
 */

import { Page } from '@/types/page';
import { parseWikiLinks, findPageByIdOrTitle } from '@/utils/wikiLinks';

export interface GraphNode {
  id: string;
  title: string;
  type: 'page' | 'orphan' | 'hub';
  connections: number; // Number of incoming + outgoing links
  tags: string[];
  children?: Page[];
}

export interface GraphEdge {
  source: string;
  target: string;
  label?: string; // Display text from [[id|label]]
  bidirectional?: boolean;
}

export interface PageGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  orphans: string[]; // Pages with no links
  hubs: string[]; // Pages with many links (>5)
  clusters: string[][]; // Groups of highly connected pages
}

export class GraphService {
  /**
   * Build a graph from all pages
   */
  buildGraph(pages: Page[]): PageGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const connectionCount = new Map<string, number>();

    // Initialize connection counts
    pages.forEach(page => {
      connectionCount.set(page.id, 0);
    });

    // Build edges from wiki links
    pages.forEach(sourcePage => {
      const wikiLinks = parseWikiLinks(sourcePage.content);

      wikiLinks.forEach(link => {
        // Parse ID-based links: [[page-id|Display Text]]
        const pipeIndex = link.target.indexOf('|');
        const targetId = pipeIndex !== -1
          ? link.target.substring(0, pipeIndex).trim()
          : link.target;
        const label = pipeIndex !== -1
          ? link.target.substring(pipeIndex + 1).trim()
          : undefined;

        const targetPage = findPageByIdOrTitle(targetId, pages);

        if (targetPage) {
          // Check if reverse edge exists (bidirectional)
          const reverseExists = edges.some(
            e => e.source === targetPage.id && e.target === sourcePage.id
          );

          if (reverseExists) {
            // Mark existing edge as bidirectional
            const reverseEdge = edges.find(
              e => e.source === targetPage.id && e.target === sourcePage.id
            );
            if (reverseEdge) {
              reverseEdge.bidirectional = true;
            }
          } else {
            edges.push({
              source: sourcePage.id,
              target: targetPage.id,
              label,
              bidirectional: false,
            });
          }

          // Increment connection counts
          connectionCount.set(sourcePage.id, (connectionCount.get(sourcePage.id) || 0) + 1);
          connectionCount.set(targetPage.id, (connectionCount.get(targetPage.id) || 0) + 1);
        }
      });
    });

    // Create nodes with connection info
    pages.forEach(page => {
      const connections = connectionCount.get(page.id) || 0;
      let type: 'page' | 'orphan' | 'hub' = 'page';

      if (connections === 0) type = 'orphan';
      else if (connections > 5) type = 'hub';

      nodes.push({
        id: page.id,
        title: page.title,
        type,
        connections,
        tags: page.tags,
        children: page.children,
      });
    });

    // Find orphans (no connections)
    const orphans = nodes.filter(n => n.type === 'orphan').map(n => n.id);

    // Find hubs (many connections)
    const hubs = nodes.filter(n => n.type === 'hub').map(n => n.id);

    // Find clusters (simple community detection)
    const clusters = this.detectClusters(nodes, edges);

    return { nodes, edges, orphans, hubs, clusters };
  }

  /**
   * Simple cluster detection using connected components
   */
  private detectClusters(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
    const visited = new Set<string>();
    const clusters: string[][] = [];

    const dfs = (nodeId: string, cluster: string[]) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      cluster.push(nodeId);

      // Find all connected nodes
      edges.forEach(edge => {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target, cluster);
        }
        if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source, cluster);
        }
      });
    };

    nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const cluster: string[] = [];
        dfs(node.id, cluster);
        if (cluster.length > 1) {
          clusters.push(cluster);
        }
      }
    });

    return clusters;
  }

  /**
   * Get shortest path between two pages
   */
  getShortestPath(
    graph: PageGraph,
    fromId: string,
    toId: string
  ): string[] | null {
    const queue: string[][] = [[fromId]];
    const visited = new Set<string>([fromId]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];

      if (current === toId) {
        return path;
      }

      // Find neighbors
      graph.edges.forEach(edge => {
        let neighbor: string | null = null;

        if (edge.source === current && !visited.has(edge.target)) {
          neighbor = edge.target;
        } else if (edge.target === current && !visited.has(edge.source)) {
          neighbor = edge.source;
        }

        if (neighbor) {
          visited.add(neighbor);
          queue.push([...path, neighbor]);
        }
      });
    }

    return null; // No path found
  }

  /**
   * Get neighbors of a page (connected pages)
   */
  getNeighbors(graph: PageGraph, pageId: string): GraphNode[] {
    const neighborIds = new Set<string>();

    graph.edges.forEach(edge => {
      if (edge.source === pageId) {
        neighborIds.add(edge.target);
      }
      if (edge.target === pageId) {
        neighborIds.add(edge.source);
      }
    });

    return graph.nodes.filter(n => neighborIds.has(n.id));
  }

  /**
   * Get backlinks (pages that link to this page)
   */
  getBacklinks(graph: PageGraph, pageId: string): GraphNode[] {
    const backlinkIds = graph.edges
      .filter(e => e.target === pageId)
      .map(e => e.source);

    return graph.nodes.filter(n => backlinkIds.includes(n.id));
  }

  /**
   * Get forward links (pages this page links to)
   */
  getForwardLinks(graph: PageGraph, pageId: string): GraphNode[] {
    const forwardLinkIds = graph.edges
      .filter(e => e.source === pageId)
      .map(e => e.target);

    return graph.nodes.filter(n => forwardLinkIds.includes(n.id));
  }
}

// Singleton instance
export const graphService = new GraphService();
