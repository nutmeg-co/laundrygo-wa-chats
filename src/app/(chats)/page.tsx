"use client";

import React, { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	ArrowLeft,
	Search,
	Send,
	Image,
	Paperclip,
	Plus,
	// File,
	Phone,
	Video,
	// Play,
} from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm"; // For strikethrough and other GitHub-flavored markdown

async function getConversations({
	after_at,
	before_at,
}: {
	after_at?: Date;
	before_at?: Date;
} = {}): Promise<Conversation[]> {
	const params = new URLSearchParams();
	if (after_at) {
		params.append("after_at", after_at.toISOString());
	}
	if (before_at) {
		params.append("before_at", before_at.toISOString());
	}
	return fetch("/conversations?" + params)
		.then((resp) => resp.json())
		.then((objs: Conversation[]) =>
			objs.map((obj) => ({
				...obj,
				last_chat_at: new Date(obj.last_chat_at),
			}))
		);
}

export default function ChatView() {
	const ref = useRef<HTMLDivElement>(null);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [selectedChat, setSelectedChat] = useState<Conversation>();
	const [isMobileMessageView, setIsMobileMessageView] = useState(false);

	useEffect(() => {
		getConversations().then(setConversations);
	}, []);
	useEffect(() => {
		const id = setInterval(async () => {
			const result =
				conversations && conversations?.length > 0
					? getConversations({
							after_at: conversations[0].last_chat_at,
					  })
					: getConversations();
			result.then((result) => {
				const ids = new Set(result.map((r) => r.id));
				setConversations((conversations) =>
					result.concat(conversations.filter((c) => !ids.has(c.id)))
				);
			});
		}, 3000);
		return () => {
			clearInterval(id);
		};
	}, [conversations]);

	const handleChatSelect = (chat: Conversation) => {
		setSelectedChat(chat);
		setIsMobileMessageView(true);
	};

	const handleBackToList = () => {
		setIsMobileMessageView(false);
	};

	return (
		<div className="flex h-screen bg-gray-100">
			{/* Chat List */}
			<div
				className={`w-full md:w-1/3 bg-white border-r ${
					isMobileMessageView ? "hidden md:block" : "block"
				}`}
			>
				<div className="p-4 border-b bg-gray-50">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
						<Input
							type="text"
							placeholder="Search chats..."
							className="w-full pl-10 pr-4 py-2 rounded-full border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
						/>
					</div>
				</div>
				<ScrollArea
					ref={ref}
					className="h-[calc(100vh-5rem)]"
					onScrollCapture={() => {
						if (!ref.current) return;

						const scrollElement = ref.current.querySelector(
							"[data-radix-scroll-area-viewport]"
						);
						if (!scrollElement) return;
						const { scrollTop, scrollHeight, clientHeight } =
							scrollElement;
						if (scrollHeight - scrollTop === clientHeight) {
							getConversations({
								before_at:
									conversations[conversations.length - 1]
										.last_chat_at,
							}).then((result) => {
								setConversations((conversations) =>
									conversations.concat(result)
								);
							});
						}
					}}
				>
					{conversations?.map((chat) => (
						<div
							key={chat.id}
							className="p-4 border-b cursor-pointer hover:bg-gray-50 transition duration-150 ease-in-out"
							onClick={() => handleChatSelect(chat)}
						>
							<div className="flex items-center">
								<Avatar className="h-12 w-12 mr-4">
									<AvatarImage
										// src={chat.avatar}
										alt={chat.name}
									/>
									<AvatarFallback>
										{(chat.name ?? chat.phone)
											.split(" ")
											.map((n) => n[0])
											.join("")}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1">
									<div className="font-semibold text-gray-800">
										{chat.name}
									</div>
									<div className="text-sm text-gray-500">
										{chat.phone}
									</div>
									<div className="text-sm text-gray-600 mt-1 flex justify-between items-center">
										<span className="truncate max-w-[180px]">
											{/* {chat.lastMessage} */}
										</span>
										<span className="text-xs text-gray-400">
											{chat.last_chat_at.toLocaleString()}
										</span>
									</div>
								</div>
							</div>
						</div>
					))}
				</ScrollArea>
			</div>

			{/* Chat Messages */}
			<div
				className={`flex-1 flex flex-col ${
					isMobileMessageView ? "block" : "hidden md:flex"
				}`}
			>
				{selectedChat && (
					<ChatMessages
						onBack={handleBackToList}
						conv={selectedChat}
					/>
				)}
			</div>
		</div>
	);
}

function fetchMessages(
	convId: string,
	q: {
		before_id?: string;
		after_id?: string;
	} = {}
): Promise<ChatMessage[]> {
	return fetch(
		`/conversations/${convId}/messages?` + new URLSearchParams(q)
	).then((resp) => resp.json());
}

function sendMessage(convId: string, msg: string): Promise<ChatMessage> {
	return fetch(`/conversations/${convId}/messages`, {
		method: "POST",
		body: JSON.stringify(msg),
	}).then((resp) => resp.json());
}

function ChatMessages({
	onBack,
	conv,
}: {
	onBack(): void;
	conv: Conversation;
}) {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [text, setText] = useState("");
	const [loading, setLoading] = useState(false);
	useEffect(() => {
		fetchMessages(conv.id).then((messages) => {
			setMessages(messages.reverse());
		});
	}, [conv.id]);
	useEffect(() => {
		const id = setInterval(() => {
			const result =
				messages.length > 0
					? fetchMessages(conv.id, {
							after_id: messages[messages.length - 1].id,
					  })
					: fetchMessages(conv.id);
			result.then((msgs) =>
				setMessages((messages) => messages.concat(msgs.reverse()))
			);
		}, 3000);
		return () => {
			clearInterval(id);
		};
	}, [conv.id, messages]);
	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [messages.length > 0 ? messages[messages.length - 1].id : ""]);
	return (
		<>
			<div className="p-4 border-b bg-white flex items-center justify-between">
				<div className="flex items-center">
					<Button
						variant="ghost"
						size="icon"
						className="mr-2 md:hidden"
						onClick={onBack}
					>
						<ArrowLeft className="h-6 w-6" />
					</Button>
					<Avatar className="h-10 w-10 mr-4">
						<AvatarImage
							// src={conv.avatar}
							alt={conv.name}
						/>
						<AvatarFallback>
							{(conv.name ?? conv.phone)
								.split(" ")
								.map((n) => n[0])
								.join("")}
						</AvatarFallback>
					</Avatar>
					<div>
						<div className="font-semibold text-gray-800">
							{conv.name}
						</div>
						<div className="text-sm text-gray-500">
							{conv.phone}
						</div>
					</div>
				</div>
				<div className="flex space-x-2">
					<Button variant="ghost" size="icon">
						<Phone className="h-5 w-5 text-gray-600" />
					</Button>
					<Button variant="ghost" size="icon">
						<Video className="h-5 w-5 text-gray-600" />
					</Button>
				</div>
			</div>
			<ScrollArea className="flex-1 p-4 bg-gray-50 flex flex-col-reverse">
				{messages.map((message) => (
					<div
						key={message.id}
						className={`mb-4 ${
							message.status === "" ? "text-left" : "text-right"
						}`}
					>
						<div
							className={`inline-block p-3 rounded-lg ${
								message.status == "failed"
									? "bg-red-500 text-white"
									: message.status == "read"
									? "bg-green-500 text-white"
									: message.status !== ""
									? "bg-blue-500 text-white"
									: "bg-white text-gray-800"
							} shadow`}
						>
							{message.content.type === "template" ? (
								message.content.template.name
							) : message.content.type === "button" ? (
								message.content.button.text
							) : message.content.type === "unsupported" ? (
								"unsupported message"
							) : message.content.type === "text" ? (
								<WaText text={message.content.text.body} />
							) : message.content.type === "image" ? (
								<WaImage
									phoneId={conv.phone_number_id}
									mediaId={message.content.image.id}
								/>
							) : message.content.type === "video" ? (
								<div className="relative">
									<video
										className="max-w-xs rounded"
										controls
									>
										<source
											src={`/phones/${conv.phone_number_id}/medias/${message.content.video.id}`}
											type="video/mp4"
										/>
										Your browser does not support the video
										tag.
									</video>
									{/* <div className="absolute inset-0 flex items-center justify-center">
										<Button
											variant="ghost"
											size="icon"
											className="bg-black bg-opacity-50 text-white rounded-full"
										>
											<Play className="h-8 w-8" />
										</Button>
									</div> */}
								</div>
							) : (
								// ) : message.content.type === "file" ? (
								// 	<div className="flex items-center">
								// 		<File className="w-4 h-4 mr-2" />
								// 		<span>{message.content}</span>
								// 	</div>
								JSON.stringify(message.content)
							)}
						</div>
						<div className="text-xs text-gray-500 mt-1">
							{message.created_at.toLocaleString()} {" / "}
							{message.status}
						</div>
					</div>
				))}
				<div ref={messagesEndRef} />
			</ScrollArea>
			<div className="p-4 border-t bg-white">
				<form className="flex items-center">
					<Popover>
						<PopoverTrigger asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								className="mr-2 text-gray-500 hover:text-gray-700"
							>
								<Plus className="h-5 w-5" />
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-40">
							<div className="flex flex-col space-y-2">
								<Button
									variant="ghost"
									className="justify-start"
								>
									<Image className="h-4 w-4 mr-2" />
									Image
								</Button>
								<Button
									variant="ghost"
									className="justify-start"
								>
									<Paperclip className="h-4 w-4 mr-2" />
									File
								</Button>
							</div>
						</PopoverContent>
					</Popover>
					<Input
						type="text"
						placeholder="Type a message..."
						className="flex-1 mr-2 rounded-full border-gray-300 focus:border-blue-500 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
						value={text}
						onChange={(event) => setText(event.target.value)}
						disabled={loading}
					/>
					<Button
						type="submit"
						size="icon"
						className="rounded-full bg-blue-500 hover:bg-blue-600 text-white"
						disabled={loading}
						onClick={async () => {
							try {
								setLoading(true);
								await sendMessage(conv.id, text);
								setText("");
							} finally {
								setLoading(false);
							}
						}}
					>
						<Send className="h-4 w-4" />
					</Button>
				</form>
			</div>
		</>
	);
}

function WaImage({ phoneId, mediaId }: { phoneId: string; mediaId: string }) {
	return (
		<img
			src={`/phones/${phoneId}/medias/${mediaId}`}
			alt="Shared image"
			className="max-w-xs rounded"
		/>
	);
}

function WaText({ text }: { text: string }) {
	// Convert WhatsApp-style formatting to markdown
	const formattedText = text
		.replace(/\*(.*?)\*/g, "**$1**") // Bold
		.replace(/_(.*?)_/g, "*$1*"); // Italics

	return (
		<Markdown
			remarkPlugins={[remarkGfm]} // Enable GitHub-flavored markdown features
		>
			{formattedText}
		</Markdown>
	);
}
