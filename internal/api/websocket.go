package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/coder/websocket"
)

type WSEvent struct {
	Type    string      `json:"type"`
	Path    string      `json:"path,omitempty"`
	Project string      `json:"project,omitempty"`
	Meta    interface{} `json:"metadata,omitempty"`
}

type client struct {
	conn *websocket.Conn
	send chan []byte
}

type Hub struct {
	clients    map[*client]bool
	broadcast  chan []byte
	register   chan *client
	unregister chan *client
	mu         sync.Mutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *client),
		unregister: make(chan *client),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()
		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			h.mu.Unlock()
		case msg := <-h.broadcast:
			h.mu.Lock()
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					delete(h.clients, c)
					close(c.send)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) Broadcast(event WSEvent) {
	data, err := json.Marshal(event)
	if err != nil {
		return
	}
	h.broadcast <- data
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		log.Printf("websocket accept error: %v", err)
		return
	}

	c := &client{
		conn: conn,
		send: make(chan []byte, 256),
	}

	s.hub.register <- c

	go s.wsWriter(c)
	s.wsReader(c)
}

func (s *Server) wsWriter(c *client) {
	defer c.conn.Close(websocket.StatusNormalClosure, "")

	for msg := range c.send {
		if err := c.conn.Write(context.Background(), websocket.MessageText, msg); err != nil {
			return
		}
	}
}

func (s *Server) wsReader(c *client) {
	defer func() {
		s.hub.unregister <- c
	}()

	for {
		_, _, err := c.conn.Read(context.Background())
		if err != nil {
			return
		}
	}
}
