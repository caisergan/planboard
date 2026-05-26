package api

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
)

func TestWebSocket_ReceivesBroadcast(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	srv := NewServerWithHub(nil, nil, hub, nil)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	wsURL := "ws" + ts.URL[4:] + "/ws"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() error: %v", err)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	time.Sleep(100 * time.Millisecond)

	hub.Broadcast(WSEvent{Type: "file-changed", Path: "/test/file.html", Project: "test"})

	_, msg, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("Read() error: %v", err)
	}

	var event WSEvent
	json.Unmarshal(msg, &event)

	if event.Type != "file-changed" {
		t.Errorf("Type = %q, want %q", event.Type, "file-changed")
	}
	if event.Path != "/test/file.html" {
		t.Errorf("Path = %q, want %q", event.Path, "/test/file.html")
	}
	if event.Project != "test" {
		t.Errorf("Project = %q, want %q", event.Project, "test")
	}
}

func TestWebSocket_MultipleClients(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	srv := NewServerWithHub(nil, nil, hub, nil)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	wsURL := "ws" + ts.URL[4:] + "/ws"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn1, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() conn1 error: %v", err)
	}
	defer conn1.Close(websocket.StatusNormalClosure, "")

	conn2, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() conn2 error: %v", err)
	}
	defer conn2.Close(websocket.StatusNormalClosure, "")

	time.Sleep(100 * time.Millisecond)

	hub.Broadcast(WSEvent{Type: "file-added", Path: "/new.html", Project: "proj"})

	for _, conn := range []*websocket.Conn{conn1, conn2} {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			t.Fatalf("Read() error: %v", err)
		}
		var event WSEvent
		json.Unmarshal(msg, &event)
		if event.Type != "file-added" {
			t.Errorf("Type = %q, want file-added", event.Type)
		}
	}
}

func TestHub_ClientDisconnect(t *testing.T) {
	hub := NewHub()
	go hub.Run()

	srv := NewServerWithHub(nil, nil, hub, nil)
	ts := httptest.NewServer(srv.Handler())
	defer ts.Close()

	wsURL := "ws" + ts.URL[4:] + "/ws"
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, _, err := websocket.Dial(ctx, wsURL, nil)
	if err != nil {
		t.Fatalf("Dial() error: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	conn.Close(websocket.StatusNormalClosure, "")
	time.Sleep(50 * time.Millisecond)

	// Broadcasting after disconnect should not panic
	hub.Broadcast(WSEvent{Type: "file-changed", Path: "/test.html"})
	time.Sleep(50 * time.Millisecond)
}
