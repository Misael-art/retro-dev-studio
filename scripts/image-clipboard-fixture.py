#!/usr/bin/env python3
"""Linux native UI test producer; never imported or executed by the product.

Modes: URL text, raster clipboard, browser HTML+PNG, or actual GTK file drag.
Requires the host's GTK3/PyGObject and ImageMagick for the browser-format fixture.
Inputs and outputs belong to the operator's private validation runtime.
"""
import gi,sys,json,signal
from pathlib import Path
gi.require_version("Gtk","3.0")
from gi.repository import Gtk,Gdk,GdkPixbuf,GLib
mode,value=sys.argv[1:3]
clipboard=Gtk.Clipboard.get(Gdk.SELECTION_CLIPBOARD)
window=None
if mode=="image": clipboard.set_image(GdkPixbuf.Pixbuf.new_from_file(value))
elif mode=="browser":
 import ctypes,ctypes.util,subprocess
 png=subprocess.check_output(["convert",f"{value}[0]","png:-"])
 html=b'<html><body><img src="https://upload.wikimedia.org/wikipedia/commons/a/a4/Animexample.gif"></body></html>'
 lib=ctypes.CDLL(ctypes.util.find_library("gtk-3"))
 capsule=ctypes.pythonapi.PyCapsule_GetPointer;capsule.argtypes=[ctypes.py_object,ctypes.c_char_p];capsule.restype=ctypes.c_void_p
 class Target(ctypes.Structure):_fields_=[("target",ctypes.c_char_p),("flags",ctypes.c_uint),("info",ctypes.c_uint)]
 targets=(Target*2)(Target(b"text/html",0,0),Target(b"image/png",0,1))
 Get=ctypes.CFUNCTYPE(None,ctypes.c_void_p,ctypes.c_void_p,ctypes.c_uint,ctypes.c_void_p)
 Clear=ctypes.CFUNCTYPE(None,ctypes.c_void_p,ctypes.c_void_p)
 lib.gtk_selection_data_get_target.argtypes=[ctypes.c_void_p];lib.gtk_selection_data_get_target.restype=ctypes.c_void_p
 lib.gtk_selection_data_set.argtypes=[ctypes.c_void_p,ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p,ctypes.c_int]
 @Get
 def get_data(clip,data,info,user):
  raw=html if info==0 else png
  lib.gtk_selection_data_set(data,lib.gtk_selection_data_get_target(data),8,ctypes.c_char_p(raw),len(raw))
  print("requested "+("text/html" if info==0 else "image/png"),flush=True)
 @Clear
 def clear_data(*args):pass
 lib.gtk_clipboard_set_with_data.argtypes=[ctypes.c_void_p,ctypes.POINTER(Target),ctypes.c_uint,Get,Clear,ctypes.c_void_p];lib.gtk_clipboard_set_with_data.restype=ctypes.c_int
 if not lib.gtk_clipboard_set_with_data(capsule(clipboard.__gpointer__,None),targets,2,get_data,clear_data,None):raise RuntimeError("Cannot own browser-format clipboard")
elif mode=="url": clipboard.set_text(value,-1)
elif mode=="drop":
 window=Gtk.Window(title="RDS image drop fixture")
 window.set_default_size(220,90);window.move(10,760);window.set_keep_above(True)
 label=Gtk.EventBox();label.add(Gtk.Label(label="Arraste a imagem para a cena"));window.add(label)
 label.drag_source_set(Gdk.ModifierType.BUTTON1_MASK,[Gtk.TargetEntry.new("text/uri-list",0,0)],Gdk.DragAction.COPY)
 def data_get(widget,ctx,data,info,time):
  print("drag-data-get",flush=True);data.set_uris([Path(value).as_uri()])
 label.connect("drag-data-get",data_get)
 label.connect("drag-begin",lambda *args:print("drag-begin",flush=True))
 label.connect("drag-end",lambda *args:print("drag-end",flush=True))
 window.show_all()
else: raise ValueError(mode)
print(json.dumps({"ready":True,"mode":mode}),flush=True)
GLib.unix_signal_add(GLib.PRIORITY_DEFAULT,signal.SIGTERM,lambda: (Gtk.main_quit(),False)[1])
Gtk.main()
